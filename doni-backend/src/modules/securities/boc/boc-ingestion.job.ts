import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from '@common/jobs/jobs.service';
import { BocIngestionService } from './boc-ingestion.service';

export const BOC_INGESTION_JOB = 'boc-ingestion';

/**
 * Weekdays at 18:30 and again at 21:30, Abidjan time (UTC+0, no daylight
 * saving). The BRVM session ends mid-afternoon and the BOC is usually online
 * by early evening; the second run catches a late bulletin and is a no-op
 * when the first one already ingested it.
 */
export const BOC_INGESTION_CRON = '30 18,21 * * 1-5';
export const BOC_INGESTION_TZ = 'Africa/Abidjan';

/**
 * Schedules the daily BOC ingestion. Set BOC_INGESTION_CRON to another cron
 * expression to move it, or to "off" to not schedule it (the e2e suite does).
 */
@Injectable()
export class BocIngestionJob implements OnApplicationBootstrap {
  private readonly logger = new Logger(BocIngestionJob.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly ingestion: BocIngestionService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const cron = this.config.get<string>(
      'BOC_INGESTION_CRON',
      BOC_INGESTION_CRON,
    );
    if (cron === 'off') {
      this.logger.log('Daily BOC ingestion is not scheduled');
      return;
    }
    await this.jobs.schedule(BOC_INGESTION_JOB, cron, () => this.run(), {
      tz: BOC_INGESTION_TZ,
    });
  }

  /** Ingests today's BOC (today in Abidjan, which is UTC). */
  async run(now = new Date()): Promise<void> {
    const today = now.toISOString().slice(0, 10);
    const result = await this.ingestion.ingest(today);
    this.logger.log(`BOC ${today}: ${result.outcome}`);
  }
}
