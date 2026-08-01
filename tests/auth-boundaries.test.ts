import { describe, expect, it } from 'vitest';
import { assertSameOrigin, CsrfError, sessionCookie, shouldRotateSession } from '@/lib/auth';

describe('auth boundaries', () => {
  it('accepts same-origin writes and rejects cross-origin writes', () => {
    expect(() => assertSameOrigin(new Request('https://example.test/api/admin/projects/1', { headers: { origin: 'https://example.test' } }))).not.toThrow();
    expect(() => assertSameOrigin(new Request('https://example.test/api/admin/projects/1', { headers: { origin: 'https://attacker.test' } }))).toThrow(CsrfError);
    expect(() => assertSameOrigin(new Request('https://example.test/api/admin/projects/1'))).toThrow('Missing origin');
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
