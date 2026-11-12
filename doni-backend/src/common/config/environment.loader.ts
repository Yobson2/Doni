import { existsSync } from 'fs';
import { resolve } from 'path';

export interface EnvironmentConfig {
  envFilePath?: string;
  ignoreEnvFile?: boolean;
  isGlobal: boolean;
  cache: boolean;
  expandVariables: boolean;
  load?: Array<() => Record<string, any>>;
}

export function isRunningInDocker(): boolean {
  return process.env.RUNNING_IN_DOCKER === 'true' || existsSync('/.dockerenv');
}

export function getEnvironmentFile(): string | undefined {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const runningInDocker = isRunningInDocker();

  if (runningInDocker) {
    console.log(
      `Running in Docker: ${nodeEnv} (environment variables injected at runtime)`,
    );
    return undefined;
  }

  const envFile = '.env';
  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) {
    console.error(`ERROR: .env file not found at ${envPath}`);
    console.error(`  Create .env file by copying .env.example:`);
    console.error(`  cp .env.example .env`);
    console.error(`  Then configure it with your ${nodeEnv} settings.`);
    throw new Error(`Required .env file not found`);
  }

  console.log(`Loading environment from .env file (NODE_ENV: ${nodeEnv})`);
  return envFile;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const runningInDocker = isRunningInDocker();
  const envFilePath = getEnvironmentFile();

  if (runningInDocker) {
    return {
      isGlobal: true,
      cache: true,
      expandVariables: false,
    };
  }

  return {
    envFilePath: envFilePath!,
    isGlobal: true,
    cache: true,
    expandVariables: true,
  };
}

export function getCurrentEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

export function getEnvConfig<T>(key: string, defaultValue: T): T {
  const value = process.env[key];

  if (value === undefined) {
    return defaultValue;
  }

  const defaultType = typeof defaultValue;

  if (defaultType === 'string') {
    return value as T;
  }

  if (defaultType === 'boolean') {
    return (value.toLowerCase() === 'true') as T;
  }

  if (defaultType === 'number') {
    const parsed = Number(value);
    return (isNaN(parsed) ? defaultValue : parsed) as T;
  }

  if (defaultType === 'object' && defaultValue !== null) {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  return value as T;
}
