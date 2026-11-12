import type { Response } from 'supertest';

/** Name of the cookie that carries the refresh token. */
export const REFRESH_COOKIE = 'doni_refresh';

export interface SessionCookies {
  /** The cookie value: the refresh token itself, or '' when cleared. */
  value: string;
  /** The Set-Cookie attributes, e.g. ['HttpOnly', 'Path=/api/auth']. */
  attributes: string[];
  /** Ready to send back in a Cookie request header. */
  header: string;
}

/** Reads the refresh cookie a response sets, failing if there is none. */
export function refreshCookieFrom(res: Response): SessionCookies {
  const raw = res.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(raw) ? (raw as string[]) : [];
  const line = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!line) {
    throw new Error(`Response did not set the ${REFRESH_COOKIE} cookie`);
  }
  const [pair, ...attributes] = line.split(';').map((part) => part.trim());
  const value = decodeURIComponent(pair.slice(REFRESH_COOKIE.length + 1));
  return { value, attributes, header: pair };
}
