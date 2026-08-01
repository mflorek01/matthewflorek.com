import { describe, expect, it } from 'vitest';
import { getUmamiAdminConfig, normalizeAnalyticsSummary } from '@/lib/analytics/admin';

describe('admin analytics configuration', () => {
  it('fails closed when any server credential is missing', () => {
    expect(getUmamiAdminConfig({ UMAMI_API_URL: 'http://umami:3000', UMAMI_WEBSITE_ID: 'site', UMAMI_API_USERNAME: 'admin' })).toBeNull();
  });
  it('accepts a complete private configuration', () => {
    expect(getUmamiAdminConfig({ UMAMI_API_URL: 'http://umami:3000/', UMAMI_WEBSITE_ID: 'site', UMAMI_API_USERNAME: 'admin', UMAMI_API_PASSWORD: 'secret' })).toMatchObject({ baseUrl: 'http://umami:3000', websiteId: 'site' });
  });
});

describe('admin analytics normalization', () => {
  it('returns bounded aggregate values without visitor identifiers', () => {
    const result = normalizeAnalyticsSummary({ stats: { visitors: 10, visits: 20, pageviews: 30, bounces: 5, totaltime: 40 }, active: { visitors: 2 }, pages: [{ x: '/work', y: 7, distinctId: 'private' }], referrers: [{ x: 'https://example.com', y: 3 }], events: [{ x: 'project_opened', y: 4 }] });
    expect(result.stats.bounceRate).toBe(25);
    expect(result.stats.averageDurationSeconds).toBe(2);
    expect(result.topPages).toEqual([{ label: '/work', value: 7 }]);
    expect(JSON.stringify(result)).not.toContain('distinctId');
  });
});
