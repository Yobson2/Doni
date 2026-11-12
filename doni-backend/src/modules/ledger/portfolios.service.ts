import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  FutureTradeDateError,
  InsufficientQuantityException,
  InvalidLedgerEntryException,
  PortfolioNotFoundError,
  UnknownLedgerSecurityError,
} from '@common/exceptions/ledger.exceptions';
import { CorporateActionsService } from '@modules/securities/corporate-actions/corporate-actions.service';
import { Security } from '@modules/securities/entities/security.entity';
import {
  PRICE_SOURCE,
  type PriceSource,
} from '@modules/securities/prices/price-source';
import {
  CreateLedgerEntryDto,
  CreateOpeningPositionDto,
  CreatePortfolioDto,
  LedgerEntryDto,
  PortfolioDto,
  PortfolioValuationDto,
  PositionDto,
} from './dto/portfolio.dto';
import {
  type CorporateAction,
  InsufficientQuantityError,
  InvalidLedgerEntryError,
  type LedgerEntry,
  type ReplayResult,
  type ValuationPrice,
  performanceStart,
  replay,
} from './engine';
import {
  LedgerEntryKind,
  LedgerEntryRecord,
} from './entities/ledger-entry.entity';
import { Portfolio } from './entities/portfolio.entity';
import { allocationOf } from './portfolio-allocation';

/**
 * Portfolios and their ledgers. Every method takes the current user's id
 * and only ever reads or writes that user's portfolios. Positions are never
 * stored: they come from replaying the ledger through the engine.
 */
@Injectable()
export class PortfoliosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Portfolio)
    private readonly portfolios: Repository<Portfolio>,
    @Inject(PRICE_SOURCE) private readonly priceSource: PriceSource,
    private readonly corporateActions: CorporateActionsService,
  ) {}

  async create(
    ownerId: string,
    dto: CreatePortfolioDto,
  ): Promise<PortfolioDto> {
    const portfolio = await this.portfolios.save(
      this.portfolios.create({ ownerId, name: dto.name }),
    );
    return toPortfolioDto(portfolio);
  }

  async list(ownerId: string): Promise<PortfolioDto[]> {
    const portfolios = await this.portfolios.find({
      where: { ownerId },
      order: { createdAt: 'ASC' },
    });
    return portfolios.map(toPortfolioDto);
  }

  async listEntries(
    ownerId: string,
    portfolioId: string,
  ): Promise<LedgerEntryDto[]> {
    await this.findOwned(this.portfolios.manager, ownerId, portfolioId);
    const entries = await this.ledgerOf(this.portfolios.manager, portfolioId);
    return entries.map(toLedgerEntryDto);
  }

  /** Appends a buy or a sell to the ledger (see `append`). */
  addEntry(
    ownerId: string,
    portfolioId: string,
    dto: CreateLedgerEntryDto,
  ): Promise<LedgerEntryDto> {
    return this.append(ownerId, portfolioId, {
      ...dto,
      fees: dto.fees ?? '0',
    });
  }

  /**
   * Appends an opening position to the ledger (see `append`): the quantity
   * held and its PMP as of a date. Its PMP is stored as the entry's price,
   * with no fees, since the PMP already includes them.
   */
  addOpeningPosition(
    ownerId: string,
    portfolioId: string,
    dto: CreateOpeningPositionDto,
  ): Promise<LedgerEntryDto> {
    const { pmp, ...rest } = dto;
    return this.append(ownerId, portfolioId, {
      ...rest,
      kind: LedgerEntryKind.OPENING_POSITION,
      price: pmp,
      fees: '0',
    });
  }

  /**
   * Appends a ledger entry, after checking that replaying the ledger with it
   * still holds: no sale, at any date, may exceed the shares held. The
   * portfolio row is locked meanwhile, so two entries recorded at once are
   * checked one after the other.
   */
  private async append(
    ownerId: string,
    portfolioId: string,
    entry: {
      kind: LedgerEntryKind;
      ticker: string;
      date: string;
      quantity: string;
      price: string;
      fees: string;
      sgi: string;
    },
  ): Promise<LedgerEntryDto> {
    return this.dataSource.transaction(async (manager) => {
      await this.findOwned(manager, ownerId, portfolioId, { lock: true });
      if (entry.date > today()) throw new FutureTradeDateError(entry.date);
      const security = await manager.findOneBy(Security, {
        ticker: entry.ticker,
      });
      if (!security) throw new UnknownLedgerSecurityError(entry.ticker);

      const candidate = manager.create(LedgerEntryRecord, {
        portfolioId,
        kind: entry.kind,
        securityId: security.id,
        tradeDate: entry.date,
        quantity: entry.quantity,
        price: entry.price,
        fees: entry.fees,
        sgi: entry.sgi,
      });
      const ledger = await this.ledgerOf(manager, portfolioId);
      const withCandidate = [
        ...ledger,
        { ...candidate, id: NEW_ENTRY, security },
      ];
      replayLedger(
        withCandidate,
        new Map(),
        await this.corporateActions.inEffectFor(securityIdsOf(withCandidate)),
      );

      const saved = await manager.save(candidate);
      return toLedgerEntryDto({ ...saved, security });
    });
  }

  /**
   * The portfolio's positions valued at the latest published end-of-day
   * price of each security, read through the PriceSource, with that price's
   * date, and how their market value is allocated.
   */
  async valuation(
    ownerId: string,
    portfolioId: string,
  ): Promise<PortfolioValuationDto> {
    const portfolio = await this.findOwned(
      this.portfolios.manager,
      ownerId,
      portfolioId,
    );
    const ledger = await this.ledgerOf(this.portfolios.manager, portfolioId);
    const securities = new Map(
      ledger.map((entry) => [entry.securityId, entry.security as Security]),
    );
    const latest = await this.priceSource.getLatestForSecurities([
      ...securities.keys(),
    ]);
    const prices = new Map<string, ValuationPrice>(
      [...latest].map(([id, price]) => [
        id,
        { close: price.close, date: price.date },
      ]),
    );

    const entries = ledger.map(toEngineEntry);
    const result = replayLedger(
      ledger,
      prices,
      await this.corporateActions.inEffectFor([...securities.keys()]),
    );
    const positions: PositionDto[] = result.positions.map((position) => {
      const security = securities.get(position.securityId) as Security;
      const { securityId: _id, ...figures } = position;
      return { ticker: security.ticker, name: security.name, ...figures };
    });
    positions.sort(
      (a, b) =>
        Number(a.quantity === '0') - Number(b.quantity === '0') ||
        a.ticker.localeCompare(b.ticker),
    );
    return {
      portfolio: toPortfolioDto(portfolio),
      positions,
      totals: result.totals,
      performanceSince: performanceStart(entries),
      allocation: allocationOf(
        result.positions,
        await this.withSectors([...securities.keys()]),
      ),
    };
  }

  /** The securities with those ids, each with its sector, by id. */
  private async withSectors(ids: string[]): Promise<Map<string, Security>> {
    const securities = await this.portfolios.manager.find(Security, {
      where: { id: In(ids) },
      relations: { sector: true },
    });
    return new Map(securities.map((security) => [security.id, security]));
  }

  /** The user's portfolio with that id; anyone else's is "not found". */
  private async findOwned(
    manager: EntityManager,
    ownerId: string,
    id: string,
    { lock = false } = {},
  ): Promise<Portfolio> {
    const portfolio = await manager.findOne(Portfolio, {
      where: { id, ownerId },
      ...(lock && { lock: { mode: 'pessimistic_write' as const } }),
    });
    if (!portfolio) throw new PortfolioNotFoundError(id);
    return portfolio;
  }

  private ledgerOf(
    manager: EntityManager,
    portfolioId: string,
  ): Promise<LedgerEntryRecord[]> {
    return manager.find(LedgerEntryRecord, {
      where: { portfolioId },
      relations: { security: true },
      order: { tradeDate: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
  }
}

/** Stands in for the id of an entry not yet saved. */
const NEW_ENTRY = 'new';

const securityIdsOf = (ledger: LedgerEntryRecord[]): string[] => [
  ...new Set(ledger.map((entry) => entry.securityId)),
];

/**
 * Replays the ledger with the corporate actions in effect, turning a broken
 * rule into an API error.
 */
function replayLedger(
  ledger: LedgerEntryRecord[],
  prices: ReadonlyMap<string, ValuationPrice>,
  corporateActions: CorporateAction[],
): ReplayResult {
  try {
    return replay({
      entries: ledger.map(toEngineEntry),
      prices,
      corporateActions,
    });
  } catch (error) {
    if (error instanceof InsufficientQuantityError) {
      const entry = ledger.find((e) => e.id === error.entryId);
      throw new InsufficientQuantityException({
        ticker: entry?.security?.ticker ?? '',
        date: error.date,
        held: error.held,
        sold: error.sold,
      });
    }
    if (error instanceof InvalidLedgerEntryError) {
      throw new InvalidLedgerEntryException(error.field, error.value);
    }
    throw error;
  }
}

function toEngineEntry(record: LedgerEntryRecord): LedgerEntry {
  const common = {
    id: record.id,
    securityId: record.securityId,
    date: record.tradeDate,
    quantity: record.quantity,
  };
  if (record.kind === LedgerEntryKind.OPENING_POSITION) {
    return { ...common, kind: 'opening_position', pmp: record.price };
  }
  return {
    ...common,
    kind: record.kind,
    price: record.price,
    fees: record.fees,
  };
}

function toPortfolioDto(portfolio: Portfolio): PortfolioDto {
  return {
    id: portfolio.id,
    name: portfolio.name,
    createdAt: portfolio.createdAt.toISOString(),
  };
}

function toLedgerEntryDto(record: LedgerEntryRecord): LedgerEntryDto {
  return {
    id: record.id,
    kind: record.kind,
    ticker: record.security?.ticker ?? '',
    securityName: record.security?.name ?? '',
    date: record.tradeDate,
    quantity: record.quantity,
    price: record.price,
    fees: record.fees,
    sgi: record.sgi,
    recordedAt: record.createdAt.toISOString(),
  };
}

/** Today's date (UTC) as YYYY-MM-DD. */
const today = () => new Date().toISOString().slice(0, 10);
