import { ADMIN_SESSION_COOKIE, SESSION_TTL_SECONDS } from './constants';

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS) {
  const secure = process.env.NODE_ENV === 'production';
  return {
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge
  };
}

export function expiredSessionCookie() {
  return sessionCookie('', 0);
}

