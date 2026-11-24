import { createHash } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import { EodPrice } from '../entities/eod-price.entity';
import { MarketIndex } from '../entities/market-index.entity';
import { PriceStatus } from '../entities/price-status';
import { Security } from '../entities/security.entity';
import {
  PRICE_DOCUMENT_PARSER,
  type ParsedTradingDay,
  type PriceDocumentParser,
} from '../prices/price-source';
import { BocBulletin, BulletinOrigin } from './boc-bulletin.entity';
import {
  BocCheck,
  type CheckContext,
  type CheckFailure,
  outcomeOf,
  runChecks,
} from './boc-checks';
import { BOC_FETCHER, type BocFetcher, type FetchedBoc } from './boc-fetcher';
import { BocNotifier } from './boc-notifier';

/**
 * Emitted once a trading day's prices are published, automatically or by an
 * admin. Anything that reacts to new prices (e.g. alerts) listens to it.
 */
export const BOC_DAY_PUBLISHED = 'boc.day-published';

export interface BocDayPublishedEvent {
  tradingDate: string;
}

export enum IngestionOutcome {
  /** Every check passed; the day's prices are served. */
  PUBLISHED = 'published',
  /** A check failed; the day is held for an admin (pending_review). */
  HELD = 'held',
  /** The same bulletin (same checksum) was already stored: nothing changed. */
  UNCHANGED = 'unchanged',
  /**
   * A different bulletin was found for a day already published. The
   * published day is kept as it is and the admins are told.
   */
  PUBLISHED_KEPT = 'published_kept',
  /** No bulletin is available for that day (not yet, or no session). */
  NOT_AVAILABLE = 'not_available',
}

/** How a bulletin is being ingested. */
export interface IngestionOptions {
  /**
   * daily (default) or backfill. A backfill day is checked against what was
   * already priced before it rather than today's whole catalogue, is never
   * announced as new prices, and keeps its origin so the read side can hide
   * it (HISTORY_PUBLIC). A bulletin already stored keeps its origin.
   */
  origin?: BulletinOrigin;
  /** Email the admins about a held day (default true; the backfill sends one summary instead). */
  notify?: boolean;
}

export interface IngestionResult {
  tradingDate: string;
  outcome: IngestionOutcome;
  failures: CheckFailure[];
}

/**
 * Daily BOC ingestion: fetch the day's bulletin, keep the PDF and its
 * checksum, read it, check it, and store its prices as published or held.
 *
 * Idempotent per trading day: the same PDF again changes nothing; a new PDF
 * for a held day replaces it; a published day is never overwritten by
 * ingestion (an admin corrects it by hand).
 */
@Injectable()
export class BocIngestionService {
  private readonly logger = new Logger(BocIngestionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(BOC_FETCHER) private readonly fetcher: BocFetcher,
    @Inject(PRICE_DOCUMENT_PARSER)
    private readonly parser: PriceDocumentParser,
    private readonly notifier: BocNotifier,
    private readonly events: EventEmitter2,
  ) {}

  async ingest(tradingDate: string): Promise<IngestionResult> {
    const fetched = await this.fetcher.fetch(tradingDate);
    if (!fetched) {
      this.logger.log(`No BOC available for ${tradingDate}`);
      return result(tradingDate, IngestionOutcome.NOT_AVAILABLE);
    }
    return this.ingestDocument(tradingDate, fetched);
  }

  /** Stores, reads and checks a bulletin already downloaded for a day. */
  async ingestDocument(
    tradingDate: string,
    fetched: FetchedBoc,
    options: IngestionOptions = {},
  ): Promise<IngestionResult> {
    const notify = options.notify ?? true;
    const checksum = sha256(fetched.document);

    const existing = await this.dataSource
      .getRepository(BocBulletin)
      .findOneBy({ tradingDate });
    if (existing?.checksum === checksum) {
      return result(tradingDate, IngestionOutcome.UNCHANGED, existing.failures);
    }
    if (existing?.status === PriceStatus.PUBLISHED) {
      this.logger.warn(
        `A different BOC was found for ${tradingDate}, which is already published; kept the published one`,
      );
      if (!notify) return result(tradingDate, IngestionOutcome.PUBLISHED_KEPT);
      await this.notifier.notifyAdmins({
        tradingDate,
        sourceUrl: fetched.sourceUrl,
        headline: 'a different bulletin was found for a published day',
        reasons: [
          `The bulletin at ${fetched.sourceUrl} differs from the one published for ${tradingDate} (checksum ${checksum} instead of ${existing.checksum}). The published day was kept; correct its prices by hand if needed.`,
        ],
      });
      return result(tradingDate, IngestionOutcome.PUBLISHED_KEPT);
    }

    const origin = existing?.origin ?? options.origin ?? BulletinOrigin.DAILY;
    const { day, failures } = await this.readAndCheck(
      fetched.document,
      tradingDate,
      origin,
    );
    const status = outcomeOf(failures);

    await this.dataSource.transaction(async (manager) => {
      const bulletin = existing ?? manager.create(BocBulletin, { tradingDate });
      Object.assign(bulletin, {
        status,
        origin,
        document: fetched.document,
        checksum,
        sourceUrl: fetched.sourceUrl,
        fetchedAt: new Date(),
        parsed: day,
        failures,
        reviewedById: null,
        reviewedAt: null,
      });
      await manager.save(bulletin);
      await this.storePrices(manager, bulletin);
    });

    if (status === PriceStatus.PUBLISHED) {
      this.logger.log(`Published the BOC of ${tradingDate}`);
      // History is not news: listeners (e.g. alerts) hear of daily days only.
      if (origin === BulletinOrigin.DAILY) this.announcePublished(tradingDate);
      return result(tradingDate, IngestionOutcome.PUBLISHED);
    }
    this.logger.warn(
      `Held the BOC of ${tradingDate} for review: ${failures.length} failed check(s)`,
    );
    if (!notify) return result(tradingDate, IngestionOutcome.HELD, failures);
    await this.notifier.notifyAdmins({
      tradingDate,
      sourceUrl: fetched.sourceUrl,
      headline: 'held for review',
      reasons: failures.map((f) => f.reason),
    });
    return result(tradingDate, IngestionOutcome.HELD, failures);
  }

  /** Tells listeners that a day's prices are now served. */
  announcePublished(tradingDate: string): void {
    const event: BocDayPublishedEvent = { tradingDate };
    this.events.emit(BOC_DAY_PUBLISHED, event);
  }

  private async readAndCheck(
    document: Buffer,
    tradingDate: string,
    origin: BulletinOrigin,
  ): Promise<{ day: ParsedTradingDay | null; failures: CheckFailure[] }> {
    let day: ParsedTradingDay;
    try {
      day = await this.parser.parse(document);
    } catch (error) {
      return {
        day: null,
        failures: [
          {
            check: BocCheck.READABLE,
            subject: null,
            reason: `The PDF could not be read: ${(error as Error).message}`,
          },
        ],
      };
    }
    const context = await this.checkContext(
      this.dataSource.manager,
      tradingDate,
      origin,
    );
    return { day, failures: runChecks(day, context) };
  }

  /** What a day read from a bulletin is checked against. */
  async checkContext(
    manager: EntityManager,
    tradingDate: string,
    origin: BulletinOrigin = BulletinOrigin.DAILY,
  ): Promise<CheckContext> {
    const securities = await manager.find(Security, {
      select: ['id', 'ticker'],
    });
    const indices = await manager.find(MarketIndex, { select: ['id', 'code'] });
    const tickerOf = new Map(securities.map((s) => [s.id, s.ticker]));
    const codeOf = new Map(indices.map((i) => [i.id, i.code]));

    const publishedCloses = new Map<string, string>();
    const handEntered = await manager.find(EodPrice, {
      where: {
        tradingDate,
        bulletinId: IsNull(),
        status: PriceStatus.PUBLISHED,
      },
    });
    for (const row of handEntered) {
      const subject = row.securityId
        ? tickerOf.get(row.securityId)
        : codeOf.get(row.indexId as string);
      if (subject) publishedCloses.set(subject, row.close);
    }

    // The printed daily variation compares with the session just before.
    const previousIndexValues = new Map<string, string>();
    const previousDay = previousWeekday(tradingDate);
    const previous = await manager
      .createQueryBuilder(EodPrice, 'p')
      .leftJoin(BocBulletin, 'b', 'b.id = p.bulletinId')
      .where('p.indexId IS NOT NULL')
      .andWhere('p.tradingDate = :previousDay', { previousDay })
      .andWhere('p.status = :published', { published: PriceStatus.PUBLISHED })
      .andWhere('(b.id IS NULL OR b.status = :published)')
      .getMany();
    for (const row of previous) {
      const code = codeOf.get(row.indexId as string);
      if (code) previousIndexValues.set(code, row.close);
    }

    return {
      expectedTradingDate: tradingDate,
      catalogueTickers: securities.map((s) => s.ticker),
      catalogueIndexCodes: indices.map((i) => i.code),
      expected:
        origin === BulletinOrigin.BACKFILL
          ? await this.pricedBefore(manager, tradingDate, tickerOf, codeOf)
          : undefined,
      previousIndexValues,
      publishedCloses,
    };
  }

  /**
   * The catalogued securities and indices with a price stored (at any
   * status) on a day before this one: what a historical bulletin must list.
   * One listed only later is not missing from an older bulletin.
   */
  private async pricedBefore(
    manager: EntityManager,
    tradingDate: string,
    tickerOf: Map<string, string>,
    codeOf: Map<string, string>,
  ): Promise<{ tickers: string[]; indexCodes: string[] }> {
    const rows = (await manager.query(
      `SELECT DISTINCT "securityId", "indexId" FROM "eod_prices" WHERE "tradingDate" < $1`,
      [tradingDate],
    )) as { securityId: string | null; indexId: string | null }[];
    const tickers = new Set<string>();
    const indexCodes = new Set<string>();
    for (const row of rows) {
      const ticker = row.securityId ? tickerOf.get(row.securityId) : undefined;
      const code = row.indexId ? codeOf.get(row.indexId) : undefined;
      if (ticker) tickers.add(ticker);
      if (code) indexCodes.add(code);
    }
    return { tickers: [...tickers], indexCodes: [...indexCodes] };
  }

  /**
   * Replaces the prices stored from this bulletin with what it now says, at
   * its status. Only catalogued securities and indices get a price; a price
   * entered by hand for the same day is left as it is.
   */
  async storePrices(
    manager: EntityManager,
    bulletin: BocBulletin,
  ): Promise<void> {
    await manager.delete(EodPrice, { bulletinId: bulletin.id });
    const day = bulletin.parsed;
    if (!day) return;
    const { tradingDate } = bulletin;

    const taken = await manager.find(EodPrice, {
      where: { tradingDate, bulletinId: IsNull() },
      select: ['securityId', 'indexId'],
    });
    const takenIds = new Set(taken.map((row) => row.securityId ?? row.indexId));

    const securities = await manager.find(Security, {
      where: { ticker: In(day.securities.map((s) => s.ticker)) },
    });
    const indices = await manager.find(MarketIndex, {
      where: { code: In(day.indices.map((i) => i.code)) },
    });
    const securityId = new Map(securities.map((s) => [s.ticker, s.id]));
    const indexId = new Map(indices.map((i) => [i.code, i.id]));

    const common = {
      tradingDate,
      high: null,
      low: null,
      sourceDocument: bulletin.sourceUrl,
      publishedOn: tradingDate,
      status: bulletin.status,
      bulletinId: bulletin.id,
    };
    const rows: Partial<EodPrice>[] = [];
    for (const s of day.securities) {
      const id = securityId.get(s.ticker);
      if (!id || takenIds.has(id)) continue;
      rows.push({
        ...common,
        securityId: id,
        indexId: null,
        close: s.close,
        open: s.open,
        volume: s.volume,
      });
    }
    for (const i of day.indices) {
      const id = indexId.get(i.code);
      if (!id || takenIds.has(id)) continue;
      rows.push({
        ...common,
        securityId: null,
        indexId: id,
        close: i.value,
        open: null,
        volume: null,
      });
    }
    if (rows.length > 0) await manager.insert(EodPrice, rows);
  }
}

function result(
  tradingDate: string,
  outcome: IngestionOutcome,
  failures: CheckFailure[] = [],
): IngestionResult {
  return { tradingDate, outcome, failures };
}

export const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

/** The weekday before a date (YYYY-MM-DD); BRVM sessions run Monday to Friday. */
export function previousWeekday(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  do {
    day.setUTCDate(day.getUTCDate() - 1);
  } while (day.getUTCDay() === 0 || day.getUTCDay() === 6);
  return day.toISOString().slice(0, 10);
}
