import { env } from '@/core/env';

import { SESSION_MAX_AGE } from './constants';

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE } from './constants';

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
}

export function getSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };
}
