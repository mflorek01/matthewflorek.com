import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('public content mode', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uses checked-in content in static mode without opening the database', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PUBLIC_CONTENT_MODE', 'static');
    const { getPublicPortfolio } = await import('@/lib/content/portfolio');
    const content = await getPublicPortfolio();
    expect(content.overview.name).toBeTruthy();
    expect(content.projects.filter((project) => project.category === 'WORK')).toHaveLength(5);
    expect(content.projects.filter((project) => project.category === 'AI')).toHaveLength(3);
    expect(content.projects.every((project) => !('publicationStatus' in project) && !('includeInAi' in project))).toBe(true);
  });

  it('propagates database failures instead of silently falling back to static content', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PUBLIC_CONTENT_MODE', 'database');
    vi.doMock('@/lib/db', () => ({ prisma: { cmsPage: { findUnique: vi.fn().mockRejectedValue(new Error('database unavailable')) } } }));
    const { getPublicPortfolio } = await import('@/lib/content/portfolio');
    await expect(getPublicPortfolio()).rejects.toThrow('database unavailable');
  });
});
