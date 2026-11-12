import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export interface AuthSecrets {
  /** Signs access tokens (bearer tokens on API requests). */
  accessSecret: string;
  /** Signs refresh tokens (the httpOnly session cookie). */
  refreshSecret: string;
}

/**
 * Reads the token-signing secrets (ADR 0011). Both are required in every
 * environment and must differ, so that one kind of token can never verify as
 * the other. Throws at boot otherwise.
 */
export const loadAuthSecrets = (config: ConfigService): AuthSecrets => {
  const accessSecret = config.get<string>('JWT_ACCESS_SECRET');
  const refreshSecret = config.get<string>('JWT_REFRESH_SECRET');

  if (!accessSecret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  if (accessSecret === refreshSecret) {
    throw new Error(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct values',
    );
  }
  return { accessSecret, refreshSecret };
};

/** Lifetime of an access token, in seconds. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Lifetime of a refresh token (and of an idle session), in seconds. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** The cookie that carries the refresh token. */
export const REFRESH_COOKIE = 'doni_refresh';

/** Only the auth endpoints (refresh, sign-out) ever receive the cookie. */
export const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * The refresh token lives only in this cookie (ADR 0011): unreadable from
 * JavaScript, sent only over HTTPS, never on cross-site requests, and only to
 * the auth endpoints.
 */
export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: REFRESH_COOKIE_PATH,
};
