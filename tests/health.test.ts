import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/db', () => ({
  isDatabaseReady: vi.fn()
}));

import { GET } from '../src/app/api/health/route';
import { isDatabaseReady } from '../src/lib/db';

afterEach(() => {
  vi.clearAllMocks();
});

describe('health route', () => {
  it('returns liveness without db check', async () => {
    const response = await GET(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: 'ok', checks: { db: 'skip' } });
  });

  it('returns readiness with db check', async () => {
    vi.mocked(isDatabaseReady).mockResolvedValue(undefined);
    const response = await GET(new Request('http://localhost/api/health?db=1'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: 'ok', checks: { db: 'pass' } });
  });

  it('returns degraded status on db failure', async () => {
    vi.mocked(isDatabaseReady).mockRejectedValue(new Error('db down'));
    const response = await GET(new Request('http://localhost/api/health?db=true'));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, status: 'degraded', checks: { db: 'fail' } });
  });
});
