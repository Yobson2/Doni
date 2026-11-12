/**
 * Environment for the end-to-end suite. Runs before each test file.
 *
 * The e2e suite never reads `.env` (see getEnvironmentConfig): it talks to a
 * dedicated, disposable test database whose schema it drops and rebuilds from
 * migrations. Override any value from the shell or CI.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'postgres',
  DB_PASS: 'postgres',
  DB_NAME: 'doni_test',
  JWT_SECRET: 'e2e-jwt-secret',
  JWT_REFRESH_SECRET: 'e2e-jwt-refresh-secret',
  // Check schedules every second so scheduled jobs run within the test.
  JOBS_CRON_MONITOR_INTERVAL_SECONDS: '1',
  JOBS_CRON_WORKER_INTERVAL_SECONDS: '1',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}

// Jest itself defaults NODE_ENV to "test"; make sure nothing overrides it.
process.env.NODE_ENV = 'test';
