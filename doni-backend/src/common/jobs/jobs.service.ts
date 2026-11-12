import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import { buildJobRunnerOptions } from './job-runner.config';

export interface ScheduleJobOptions {
  /** IANA time zone the cron expression is read in. Defaults to UTC. */
  tz?: string;
}

/**
 * The job runner: background and scheduled jobs on pg-boss, stored in the
 * application's Postgres database. Starts and stops with the Nest app.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly boss: PgBoss;
  private running = false;

  constructor(config: ConfigService) {
    this.boss = new PgBoss(buildJobRunnerOptions(config));
    this.boss.on('error', (error) =>
      this.logger.error(`Job runner error: ${error.message}`, error.stack),
    );
    this.boss.on('stopped', () => {
      this.running = false;
    });
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();
    this.running = true;
    this.logger.log('Job runner started');
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    // Let in-flight jobs finish (bounded), then close the connection pool.
    await this.boss.stop({ graceful: true, wait: true, timeout: 10000 });
  }

  /** True once pg-boss has started and until it stops. */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Runs `handler` on the given cron schedule. Idempotent: the queue and the
   * schedule are created or updated, so it is safe to call on every boot.
   */
  async schedule<T extends object = object>(
    name: string,
    cron: string,
    handler: (data: T) => Promise<void> | void,
    options: ScheduleJobOptions = {},
  ): Promise<void> {
    await this.boss.createQueue(name);
    await this.boss.schedule(name, cron, {}, { tz: options.tz ?? 'UTC' });
    await this.boss.work<T>(name, async (jobs) => {
      for (const job of jobs) {
        await handler(job.data);
      }
    });
  }

  /** Schedules registered with the job runner. */
  getSchedules(): Promise<PgBoss.Schedule[]> {
    return this.boss.getSchedules();
  }
}
