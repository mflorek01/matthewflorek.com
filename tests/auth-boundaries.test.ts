import { describe, expect, it } from 'vitest';
import { assertSameOrigin, CsrfError, sessionCookie, shouldRotateSession } from '@/lib/auth';

describe('auth boundaries', () => {
  it('accepts same-origin writes and rejects cross-origin writes', () => {
    expect(() => assertSameOrigin(new Request('https://example.test/api/admin/projects/1', { headers: { origin: 'https://example.test' } }))).not.toThrow();
    expect(() => assertSameOrigin(new Request('https://example.test/api/admin/projects/1', { headers: { origin: 'https://attacker.test' } }))).toThrow(CsrfError);
    expect(() => assertSameOrigin(new Request('https://example.test/api/admin/projects/1'))).toThrow('Missing origin');
  });

  it('uses the trusted forwarded origin behind the reverse proxy', () => {
    const request = new Request('http://portfolio:3000/api/auth/login', {
      headers: {
        origin: 'https://matthewflorek.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'matthewflorek.com'
      }
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
    expect(() => assertSameOrigin(new Request(request, { headers: { ...Object.fromEntries(request.headers), origin: 'https://attacker.test' } }))).toThrow(CsrfError);
  });

  it('sets opaque session cookies with secure browser defaults', () => {
    const cookie = sessionCookie('opaque-token');
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.path).toBe('/');
    expect(cookie.value).toBe('opaque-token');
  });

  it('rotates sessions inside the configured renewal window', () => {
    expect(shouldRotateSession(new Date(Date.now() + 60 * 60 * 1000))).toBe(true);
    expect(shouldRotateSession(new Date(Date.now() + 5 * 60 * 60 * 1000))).toBe(false);
  });
});
