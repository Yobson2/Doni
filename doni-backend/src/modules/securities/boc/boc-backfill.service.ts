import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PriceStatus } from '../entities/price-status';
import { Security } from '../entities/security.entity';
import { BocBulletin, BulletinOrigin } from './boc-bulletin.entity';
import type { CheckFailure } from './boc-checks';
import type { BocFetcher } from './boc-fetcher';
import { BocIngestionService, IngestionOutcome } from './boc-ingestion.service';
import { BocNotifier } from './boc-notifier';

/** What happened to one weekday of the backfill. */
export enum BackfillDayOutcome {
  /** Every check passed: stored as published (hidden until HISTORY_PUBLIC). */
  IMPORTED = 'imported',
  /** A check failed: stored as pending_review for an admin. */
  HELD = 'held',
  /** No bulletin on brvm.org for that weekday (holiday, or not online). */
  NOT_FOUND = 'not_found',
  /**
   * A bulletin was already stored for that day by the daily ingestion, or
   * already published: left as it is, nothing downloaded.
   */
  ALREADY_STORED = 'already_stored',
}

export interface BackfillDay {
  tradingDate: string;
  outcome: BackfillDayOutcome;
  /** Why the day is held. */
  failures: CheckFailure[];
  /** The layout the bulletin was read in, when it could be read. */
  layout: string | null;
  sourceUrl: string | null;
}

export interface BackfillSummary {
  days: BackfillDay[];
  /**
   * Securities listed in the bulletins but not in the catalogue (delisted or
   * renamed since, or never catalogued): their rows are not stored. Ticker to
   * number of days listed.
   */
  uncatalogued: Map<string, number>;
}

export interface BackfillOptions {
  /** The trading days to backfill, oldest first (see weekdaysBetween). */
  days: string[];
  fetcher: BocFetcher;
  /** Download again the days a previous run held (default: keep them). */
  retryHeld?: boolean;
  /** Called after each day, e.g. to print progress. */
  onDay?: (day: BackfillDay) => void;
}

/**
 * The one-time historical backfill (ADR 0018): each trading day's BOC is
 * downloaded, stored and checked by the same ingestion and the same
 * automatic checks as the daily run, marked as backfill so users do not see
 * it until the licence gate is cleared.
 *
 * Built to be stopped and run again: a day already stored is not
 * downloaded again (a held backfill day only with `retryHeld`), and a
 * published day is never overwritten. Held days send no email each; the
 * admins get one summary at the end.
 */
@Injectable()
export class BocBackfillService {
  private readonly logger = new Logger(BocBackfillService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ingestion: BocIngestionService,
    private readonly notifier: BocNotifier,
  ) {}

  async run(options: BackfillOptions): Promise<BackfillSummary> {
    const summary: BackfillSummary = { days: [], uncatalogued: new Map() };
    const bulletins = this.dataSource.getRepository(BocBulletin);
    const catalogue = new Set(
      (
        await this.dataSource
          .getRepository(Security)
          .find({ select: ['ticker'] })
      ).map((s) => s.ticker),
    );

    for (const tradingDate of options.days) {
      let day: BackfillDay;
      const existing = await bulletins.findOneBy({ tradingDate });
      const keep =
        existing &&
        (existing.status === PriceStatus.PUBLISHED ||
          existing.origin === BulletinOrigin.DAILY ||
          !options.retryHeld);
      if (existing && keep) {
        day = toDay(existing, existing.origin === BulletinOrigin.DAILY);
      } else {
        const fetched = await options.fetcher.fetch(tradingDate);
        if (!fetched) {
          day = {
            tradingDate,
            outcome: BackfillDayOutcome.NOT_FOUND,
            failures: [],
            layout: null,
            sourceUrl: null,
          };
        } else {
          const result = await this.ingestion.ingestDocument(
            tradingDate,
            fetched,
            { origin: BulletinOrigin.BACKFILL, notify: false },
          );
          const stored = await bulletins.findOneByOrFail({ tradingDate });
          day = toDay(
            stored,
            result.outcome === IngestionOutcome.PUBLISHED_KEPT,
          );
        }
      }
      if (day.outcome !== BackfillDayOutcome.NOT_FOUND) {
        await this.countUncatalogued(tradingDate, catalogue, summary);
      }
      summary.days.push(day);
      options.onDay?.(day);
    }

    const held = summary.days.filter(
      (d) => d.outcome === BackfillDayOutcome.HELD,
    );
    if (held.length > 0) {
      const first = options.days[0];
      const last = options.days[options.days.length - 1];
      this.logger.warn(`Backfill: ${held.length} day(s) held for review`);
      await this.notifier.notifyAdmins({
        tradingDate: `${first} to ${last}`,
        sourceUrl: 'historical backfill',
        headline: `backfill: ${held.length} day(s) held for review`,
        reasons: groupFailures(held).map(
          (g) => `${g.check}: ${g.days.length} day(s), e.g. ${g.example}`,
        ),
      });
    }
    return summary;
  }

  private async countUncatalogued(
    tradingDate: string,
    catalogue: Set<string>,
    summary: BackfillSummary,
  ): Promise<void> {
    const bulletin = await this.dataSource
      .getRepository(BocBulletin)
      .findOneBy({ tradingDate });
    for (const row of bulletin?.parsed?.securities ?? []) {
      if (catalogue.has(row.ticker)) continue;
      summary.uncatalogued.set(
        row.ticker,
        (summary.uncatalogued.get(row.ticker) ?? 0) + 1,
      );
    }
  }
}

function toDay(bulletin: BocBulletin, alreadyStored: boolean): BackfillDay {
  const outcome = alreadyStored
    ? BackfillDayOutcome.ALREADY_STORED
    : bulletin.status === PriceStatus.PUBLISHED
      ? BackfillDayOutcome.IMPORTED
      : BackfillDayOutcome.HELD;
  return {
    tradingDate: bulletin.tradingDate,
    outcome,
    failures: bulletin.failures,
    layout: bulletin.parsed?.layout ?? null,
    sourceUrl: bulletin.sourceUrl,
  };
}

/** Held days by the check that failed, most frequent first. */
export function groupFailures(
  held: BackfillDay[],
): { check: string; days: string[]; example: string }[] {
  const groups = new Map<string, { days: Set<string>; example: string }>();
  for (const day of held) {
    for (const failure of day.failures) {
      const group = groups.get(failure.check) ?? {
        days: new Set<string>(),
        example: `${day.tradingDate}: ${failure.reason}`,
      };
      group.days.add(day.tradingDate);
      groups.set(failure.check, group);
    }
  }
  return [...groups.entries()]
    .map(([check, g]) => ({ check, days: [...g.days], example: g.example }))
    .sort(
      (a, b) => b.days.length - a.days.length || (a.check < b.check ? -1 : 1),
    );
}

/** Every weekday from `from` to `to` (YYYY-MM-DD, inclusive), oldest first. */
export function weekdaysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const day = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (; day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      days.push(day.toISOString().slice(0, 10));
    }
  }
  return days;
}
