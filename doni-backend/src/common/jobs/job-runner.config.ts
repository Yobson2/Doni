import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import { buildDbSslOptions } from '@common/database/database.config';

/** Postgres schema that holds pg-boss's own tables, apart from app tables. */
export const JOB_RUNNER_SCHEMA = 'pgboss';

const optionalSeconds = (
  config: ConfigService,
  key: string,
): number | undefined => {
  const value = config.get<string>(key);
  return value ? Number(value) : undefined;
};

/**
 * pg-boss options. The job runner uses the application database (same DB_*
 * settings and TLS as TypeORM); pg-boss creates and upgrades its own tables
 * in the `pgboss` schema when it starts.
 */
export const buildJobRunnerOptions = (
  config: ConfigService,
): PgBoss.ConstructorOptions => {
  const options: PgBoss.ConstructorOptions = {
    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get<string>('DB_PORT', '5432')),
    user: config.get<string>('DB_USER', 'postgres'),
    password: config.get<string>('DB_PASS', ''),
    database: config.get<string>('DB_NAME', 'app_db'),
    ssl: buildDbSslOptions(config),
    schema: JOB_RUNNER_SCHEMA,
    application_name: 'doni-jobs',
    max: Number(config.get<string>('JOBS_POOL_SIZE', '4')),
  };

  // How often pg-boss checks schedules and turns due ones into jobs. The
  // defaults (30s / 5s) suit production; tests shorten them.
  const cronMonitor = optionalSeconds(
    config,
    'JOBS_CRON_MONITOR_INTERVAL_SECONDS',
  );
  const cronWorker = optionalSeconds(
    config,
    'JOBS_CRON_WORKER_INTERVAL_SECONDS',
  );
  if (cronMonitor) options.cronMonitorIntervalSeconds = cronMonitor;
  if (cronWorker) options.cronWorkerIntervalSeconds = cronWorker;

  return options;
};
