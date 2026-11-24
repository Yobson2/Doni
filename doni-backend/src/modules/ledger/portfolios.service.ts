import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  FutureTradeDateError,
  LedgerEntryNotFoundError,
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
  type ReplayResult,
  type ValuationPrice,
  performanceStart,
  replay,
} from './engine';
import {
  LedgerEntryKind,
  LedgerEntryRecord,
} from './entities/ledger-entry.entity';
import { LedgerEntryVoid } from './entities/ledger-entry-void.entity';
import { Portfolio } from './entities/portfolio.entity';
import {
  findOwnedPortfolio,
  ledgerOf,
  toEngineEntry,
  toLedgerEntryDto,
  today,
  withLedgerErrors,
} from './ledger-records';
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
    const manager = this.portfolios.manager;
    await findOwnedPortfolio(manager, ownerId, portfolioId);
    const entries = await ledgerOf(manager, portfolioId);
    const replaced =
      entries.length === 0
        ? []
        : await manager.find(LedgerEntryVoid, {
            where: { replacementId: In(entries.map((e) => e.id)) },
          });
    const replacesOf = new Map(
      replaced.map((v) => [v.replacementId, v.entryId]),
    );
    return entries.map((entry) =>
      toLedgerEntryDto(entry, replacesOf.get(entry.id) ?? null),
    );
  }

  /** Appends a buy or a sell to the ledger (see `change`). */
  async addEntry(
    ownerId: string,
    portfolioId: string,
    dto: CreateLedgerEntryDto,
  ): Promise<LedgerEntryDto> {
    return (await this.change(ownerId, portfolioId, {
      entry: tradeValues(dto),
    }))!;
  }

  /**
   * Appends an opening position to the ledger (see `change`): the quantity
   * held and its PMP as of a date.
   */
  async addOpeningPosition(
    ownerId: string,
    portfolioId: string,
    dto: CreateOpeningPositionDto,
  ): Promise<LedgerEntryDto> {
    return (await this.change(ownerId, portfolioId, {
      entry: openingValues(dto),
    }))!;
  }

  /**
   * Corrects a buy or a sell (see `change`): a new entry with the corrected
   * values replaces it. Returns the new entry.
   */
  async editEntry(
    ownerId: string,
    portfolioId: string,
    entryId: string,
    dto: CreateLedgerEntryDto,
  ): Promise<LedgerEntryDto> {
    return (await this.change(ownerId, portfolioId, {
      voids: { id: entryId, kinds: TRADE_KINDS },
      entry: tradeValues(dto),
    }))!;
  }

  /** Corrects an opening position, like `editEntry`. */
  async editOpeningPosition(
    ownerId: string,
    portfolioId: string,
    entryId: string,
    dto: CreateOpeningPositionDto,
  ): Promise<LedgerEntryDto> {
    return (await this.change(ownerId, portfolioId, {
      voids: { id: entryId, kinds: [LedgerEntryKind.OPENING_POSITION] },
      entry: openingValues(dto),
    }))!;
  }

  /** Deletes a ledger entry of any kind (see `change`). */
  async deleteEntry(
    ownerId: string,
    portfolioId: string,
    entryId: string,
  ): Promise<void> {
    await this.change(ownerId, portfolioId, {
      voids: { id: entryId, kinds: Object.values(LedgerEntryKind) },
    });
  }

  /**
   * The one way the ledger changes (ADR 0004): appends `entry`, voids the
   * entry `voids` names (a deletion), or both (an edit: the new entry
   * replaces the voided one). Nothing is ever overwritten.
   *
   * The change is refused unless the ledger it leaves still replays, with
   * the corporate actions in effect: no sale, at any date, may exceed the
   * shares then held, and no two opening positions may state the same
   * security on the same day. The portfolio row is locked meanwhile, so two
   * changes made at once are checked one after the other.
   *
   * @returns the new entry, or null for a deletion.
   */
  private async change(
    ownerId: string,
    portfolioId: string,
    change: {
      voids?: { id: string; kinds: readonly LedgerEntryKind[] };
      entry?: EntryValues;
    },
  ): Promise<LedgerEntryDto | null> {
    return this.dataSource.transaction(async (manager) => {
      await findOwnedPortfolio(manager, ownerId, portfolioId, { lock: true });
      const ledger = await ledgerOf(manager, portfolioId);

      let voided: LedgerEntryRecord | undefined;
      if (change.voids) {
        const { id, kinds } = change.voids;
        voided = ledger.find(
          (e) => e.id === id.toLowerCase() && kinds.includes(e.kind),
        );
        if (!voided) throw new LedgerEntryNotFoundError(id);
      }
      const candidate =
        change.entry &&
        (await this.newEntry(manager, portfolioId, change.entry));

      const next = ledger.filter((entry) => entry !== voided);
      if (candidate) next.push({ ...candidate, id: NEW_ENTRY });
      replayLedger(
        next,
        new Map(),
        await this.corporateActions.inEffectFor(securityIdsOf(next)),
      );

      const saved = candidate && (await manager.save(candidate));
      if (voided) {
        await manager.insert(LedgerEntryVoid, {
          entryId: voided.id,
          replacementId: saved?.id ?? null,
        });
      }
      return saved
        ? toLedgerEntryDto(
            { ...saved, security: candidate.security },
            voided?.id ?? null,
          )
        : null;
    });
  }

  /** A ledger entry not yet saved, checked for a known security and date. */
  private async newEntry(
    manager: EntityManager,
    portfolioId: string,
    entry: EntryValues,
  ): Promise<LedgerEntryRecord> {
    if (entry.date > today()) throw new FutureTradeDateError(entry.date);
    const security = await manager.findOneBy(Security, {
      ticker: entry.ticker,
    });
    if (!security) throw new UnknownLedgerSecurityError(entry.ticker);
    const record = manager.create(LedgerEntryRecord, {
      portfolioId,
      kind: entry.kind,
      securityId: security.id,
      tradeDate: entry.date,
      quantity: entry.quantity,
      price: entry.price,
      fees: entry.fees,
      sgi: entry.sgi,
    });
    record.security = security;
    return record;
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
    const portfolio = await findOwnedPortfolio(
      this.portfolios.manager,
      ownerId,
      portfolioId,
    );
    const ledger = await ledgerOf(this.portfolios.manager, portfolioId);
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
}

/** Stands in for the id of an entry not yet saved. */
const NEW_ENTRY = 'new';

const TRADE_KINDS = [LedgerEntryKind.BUY, LedgerEntryKind.SELL] as const;

/** A ledger entry's values as the API receives them. */
interface EntryValues {
  kind: LedgerEntryKind;
  ticker: string;
  date: string;
  quantity: string;
  price: string;
  fees: string;
  sgi: string;
}

const tradeValues = (dto: CreateLedgerEntryDto): EntryValues => ({
  ...dto,
  fees: dto.fees ?? '0',
});

/**
 * An opening position's PMP is stored as the entry's price, with no fees,
 * since the PMP already includes them.
 */
const openingValues = ({
  pmp,
  ...rest
}: CreateOpeningPositionDto): EntryValues => ({
  ...rest,
  kind: LedgerEntryKind.OPENING_POSITION,
  price: pmp,
  fees: '0',
});

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
  return withLedgerErrors(ledger, () =>
    replay({ entries: ledger.map(toEngineEntry), prices, corporateActions }),
  );
}

function toPortfolioDto(portfolio: Portfolio): PortfolioDto {
  return {
    id: portfolio.id,
    name: portfolio.name,
    createdAt: portfolio.createdAt.toISOString(),
  };
}
