import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '@common/decorators/public.decorator';
import { HeartbeatJob } from '@common/jobs/heartbeat.job';
import { JobsService } from '@common/jobs/jobs.service';

type CheckStatus = 'up' | 'down';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jobs: JobsService,
    private readonly heartbeat: HeartbeatJob,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Health check: database and job runner status',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    const database = await this.checkDatabase();
    const jobs = this.checkJobs();
    const healthy = database.status === 'up' && jobs.status === 'up';

    if (!healthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: healthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: { database, jobs },
    };
  }

  private async checkDatabase(): Promise<{ status: CheckStatus }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch {
      return { status: 'down' };
    }
  }

  private checkJobs(): {
    status: CheckStatus;
    lastHeartbeatAt: string | null;
  } {
    return {
      status: this.jobs.isRunning() ? 'up' : 'down',
      lastHeartbeatAt: this.heartbeat.getLastRunAt()?.toISOString() ?? null,
    };
  }
}
