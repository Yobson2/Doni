import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  HEARTBEAT_CRON,
  HEARTBEAT_JOB,
  HeartbeatJob,
} from '../src/common/jobs/heartbeat.job';
import { JobsService } from '../src/common/jobs/jobs.service';
import { migrateEmptyDatabase } from './support/database';
import { createTestApp } from './support/test-app';

async function waitFor<T>(
  probe: () => T | null | undefined,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe('Job runner (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await migrateEmptyDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers the heartbeat schedule with pg-boss', async () => {
    const schedules = await app.get(JobsService).getSchedules();

    expect(schedules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: HEARTBEAT_JOB, cron: HEARTBEAT_CRON }),
      ]),
    );
  });

  it('runs the scheduled heartbeat job through pg-boss', async () => {
    const heartbeat = app.get(HeartbeatJob);

    const ranAt = await waitFor(() => heartbeat.getLastRunAt(), 20000);

    expect(ranAt).toBeInstanceOf(Date);
  });

  it('reports the database and the job runner in the health check', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toEqual({ status: 'up' });
    expect(res.body.checks.jobs.status).toBe('up');
    expect(typeof res.body.checks.jobs.lastHeartbeatAt).toBe('string');
  });
});
