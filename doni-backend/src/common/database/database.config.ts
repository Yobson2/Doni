import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Builds TypeORM configuration for the application database.
 *
 * Reads DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME from environment.
 * Automatically handles SSL/TLS for managed databases in staging/production.
 *
 * @param config - ConfigService instance
 */
export const buildDbConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const host = config.get<string>('DB_HOST', 'localhost');
  const port = config.get<number>('DB_PORT', 5432);
  const username = config.get<string>('DB_USER', 'postgres');
  const password = config.get<string>('DB_PASS', '');
  const database = config.get<string>('DB_NAME', 'app_db');

  if (config.get('NODE_ENV') === 'development') {
    console.log(`Database Config:`, { host, port, database, username });
  }

  const nodeEnv = config.get<string>('NODE_ENV');
  const useManagedDB = nodeEnv === 'staging' || nodeEnv === 'production';

  const sslOptions = useManagedDB
    ? {
        rejectUnauthorized:
          config.get('DB_SSL_REJECT_UNAUTHORIZED', 'false') === 'true',
        ...(config.get<string>('DB_CA_CERT') && {
          ca: config.get<string>('DB_CA_CERT'),
        }),
      }
    : false;

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    autoLoadEntities: true,
    synchronize: nodeEnv === 'development' || nodeEnv === 'test',
    logging: nodeEnv === 'development' ? ['error', 'warn'] : ['error'],

    ssl: sslOptions,

    extra: {
      max: config.get<number>('DB_POOL_SIZE', useManagedDB ? 5 : 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.get<number>(
        'DB_CONNECT_TIMEOUT',
        10000,
      ),
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ...(useManagedDB && sslOptions ? { ssl: sslOptions } : {}),
    },

    retryAttempts: useManagedDB
      ? config.get<number>('DB_RETRY_ATTEMPTS', 5)
      : config.get<number>('DB_RETRY_ATTEMPTS', 3),
    retryDelay: config.get<number>('DB_RETRY_DELAY', 3000),

    maxQueryExecutionTime: config.get<number>('DB_MAX_QUERY_TIME', 5000),
  };
};
