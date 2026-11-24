/**
 * The one-time historical BOC backfill (ADR 0018): downloads each weekday's
 * bulletin from brvm.org, stores and checks it with the daily ingestion's
 * service and checks, and writes a report. Backfilled prices stay hidden from
 * users until HISTORY_PUBLIC=true.
 *
 *   pnpm --filter doni-backend backfill:boc --from 2016-01-01 --to 2025-12-31 \
 *     [--pause-ms 2000] [--report ../docs/backfill-report.md] [--retry-held]
 *
 * Run it against the database named by DB_* (or `.env`), migrations applied.
 * For a sample, --ranges takes several periods instead of --from/--to:
 *   --ranges 2017-11-01:2017-11-30,2019-03-01:2019-03-31
 *
 * It can be stopped and run again: days already stored are not downloaded
 * again, published days are never overwritten. --pause-ms is the wait before
 * each request to brvm.org (at most two per weekday).
 */
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  BocBackfillService,
  weekdaysBetween,
} from '../src/modules/securities/boc/boc-backfill.service';
import {
  countBackfill,
  renderBackfillReport,
} from '../src/modules/securities/boc/boc-backfill-report';
import {
  ArchivedBocFetcher,
  DEFAULT_BOC_FILES_URL,
} from '../src/modules/securities/boc/boc-fetcher';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function option(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

async function main(): Promise<void> {
  const ranges = (option('ranges') ?? `${option('from')}:${option('to')}`)
    .split(',')
    .map((range) => range.split(':'));
  for (const [start, end] of ranges) {
    if (!DATE.test(start) || !DATE.test(end) || start > end) {
      throw new Error(
        'Usage: backfill:boc --from YYYY-MM-DD --to YYYY-MM-DD (or --ranges FROM:TO,FROM:TO)',
      );
    }
  }
  const from = ranges[0][0];
  const to = ranges[ranges.length - 1][1];
  const pauseMs = Number(option('pause-ms') ?? 2000);
  const reportPath = option('report') ?? `backfill-report-${from}-${to}.md`;
  const title = option('title') ?? `BOC backfill report, ${from} to ${to}`;

  // The backfill is the only job of this process.
  process.env.BOC_INGESTION_CRON = 'off';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const fetcher = new ArchivedBocFetcher(
      process.env.BOC_FILES_URL ?? DEFAULT_BOC_FILES_URL,
      pauseMs,
    );
    const summary = await app.get(BocBackfillService).run({
      days: ranges.flatMap(([start, end]) => weekdaysBetween(start, end)),
      fetcher,
      retryHeld: process.argv.includes('--retry-held'),
      onDay: (day) => console.log(`${day.tradingDate} ${day.outcome}`),
    });
    writeFileSync(
      reportPath,
      renderBackfillReport(summary, {
        title,
        from,
        to,
        ranges:
          ranges.length > 1 ? ranges.map((r) => r.join(' to ')) : undefined,
        downloadErrors: [...fetcher.downloadErrors].sort(),
        generatedAt: new Date().toISOString(),
      }),
    );
    const counts = countBackfill(summary);
    console.log(
      `Done: ${counts.imported} imported, ${counts.held} held, ${counts.notFound} not found, ${counts.alreadyStored} already stored; ${fetcher.requests} request(s). Report: ${reportPath}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
