import type { CookieOptions, Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_TTL_SECONDS,
} from './auth-session.constants';

export { AUTH_COOKIE_NAME } from './auth-session.constants';

function getAuthCookieBaseOptions(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: config.get('NODE_ENV') === 'production',
    sameSite: 'strict',
    path: '/api',
  };
}

export function getAuthCookieOptions(config: ConfigService): CookieOptions {
  return {
    ...getAuthCookieBaseOptions(config),
    maxAge: AUTH_SESSION_TTL_SECONDS * 1000,
  };
}

export function getAuthCookieClearOptions(
  config: ConfigService,
): CookieOptions {
  return getAuthCookieBaseOptions(config);
}

export function extractAuthCookie(request: Request): string | null {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[AUTH_COOKIE_NAME];
  return typeof token === 'string' ? token : null;
}
