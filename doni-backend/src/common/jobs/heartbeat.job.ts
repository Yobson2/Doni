import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { JobsService } from './jobs.service';

export const HEARTBEAT_JOB = 'system-heartbeat';
export const HEARTBEAT_CRON = '* * * * *';

/**
 * Sample scheduled job: every minute the job runner records that it is
 * processing scheduled work. The health check reports the last run.
 */
@Injectable()
export class HeartbeatJob implements OnApplicationBootstrap {
  private lastRunAt: Date | null = null;

  constructor(private readonly jobs: JobsService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.jobs.schedule(HEARTBEAT_JOB, HEARTBEAT_CRON, () => this.run());
  }

  run(): void {
    this.lastRunAt = new Date();
  }

  /** When the heartbeat last ran in this process, or null if not yet. */
  getLastRunAt(): Date | null {
    return this.lastRunAt;
  }
}
