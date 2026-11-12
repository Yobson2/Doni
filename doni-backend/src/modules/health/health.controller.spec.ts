import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { HeartbeatJob } from '@common/jobs/heartbeat.job';
import { JobsService } from '@common/jobs/jobs.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const dataSource = { query: jest.fn() };
  const jobs = { isRunning: jest.fn() };
  const heartbeat = { getLastRunAt: jest.fn() };
  let controller: HealthController;
  let res: { status: jest.Mock };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: dataSource },
        { provide: JobsService, useValue: jobs },
        { provide: HeartbeatJob, useValue: heartbeat },
      ],
    }).compile();
    controller = module.get(HealthController);
    res = { status: jest.fn() };
  });

  const check = () => controller.check(res as unknown as Response);

  it('reports ok when the database and the job runner are up', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    jobs.isRunning.mockReturnValue(true);
    heartbeat.getLastRunAt.mockReturnValue(
      new Date('2026-01-05T10:00:00.000Z'),
    );

    const body = await check();

    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({
      database: { status: 'up' },
      jobs: { status: 'up', lastHeartbeatAt: '2026-01-05T10:00:00.000Z' },
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 503 when the database is unreachable', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));
    jobs.isRunning.mockReturnValue(true);
    heartbeat.getLastRunAt.mockReturnValue(null);

    const body = await check();

    expect(body.status).toBe('error');
    expect(body.checks.database).toEqual({ status: 'down' });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('answers 503 when the job runner is not running', async () => {
    dataSource.query.mockResolvedValue([]);
    jobs.isRunning.mockReturnValue(false);
    heartbeat.getLastRunAt.mockReturnValue(null);

    const body = await check();

    expect(body.status).toBe('error');
    expect(body.checks.jobs).toEqual({ status: 'down', lastHeartbeatAt: null });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
