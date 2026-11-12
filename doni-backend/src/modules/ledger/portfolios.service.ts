import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  ConflictingOpeningPositionsException,
  FutureTradeDateError,
  InsufficientQuantityException,
  InvalidLedgerEntryException,
  LedgerEntryNotFoundError,
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
  ConflictingOpeningPositionsError,
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
import { LedgerEntryVoid } from './entities/ledger-entry-void.entity';
import { Portfolio } from './entities/portfolio.entity';

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
    await this.findOwned(manager, ownerId, portfolioId);
    const entries = await this.ledgerOf(manager, portfolioId);
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
      await this.findOwned(manager, ownerId, portfolioId, { lock: true });
      const ledger = await this.ledgerOf(manager, portfolioId);

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
   * date.
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
    };
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

  /**
   * The portfolio's ledger as it stands: every entry not voided by a
   * correction, oldest trade first.
   */
  private ledgerOf(
    manager: EntityManager,
    portfolioId: string,
  ): Promise<LedgerEntryRecord[]> {
    return manager
      .createQueryBuilder(LedgerEntryRecord, 'entry')
      .innerJoinAndSelect('entry.security', 'security')
      .where('entry.portfolioId = :portfolioId', { portfolioId })
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM "ledger_entry_voids" "void" WHERE "void"."entryId" = "entry"."id")`,
      )
      .orderBy('entry.tradeDate', 'ASC')
      .addOrderBy('entry.createdAt', 'ASC')
      .addOrderBy('entry.id', 'ASC')
      .getMany();
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
    if (error instanceof ConflictingOpeningPositionsError) {
      const entry = ledger.find((e) => e.id === error.entryId);
      throw new ConflictingOpeningPositionsException({
        ticker: entry?.security?.ticker ?? '',
        date: error.date,
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

function toLedgerEntryDto(
  record: LedgerEntryRecord,
  replacesId: string | null,
): LedgerEntryDto {
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
    replacesId,
  };
}

/** Today's date (UTC) as YYYY-MM-DD. */
const today = () => new Date().toISOString().slice(0, 10);
