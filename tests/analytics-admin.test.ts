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
    const result = normalizeAnalyticsSummary({
      stats: { visitors: 10, visits: 20, pageviews: 30, bounces: 5, totaltime: 40 },
      active: { visitors: 2 },
      pages: [{ x: '/work', y: 7, distinctId: 'private' }],
      referrers: [{ x: 'https://example.com', y: 3 }],
      events: [{ x: 'project_opened', y: 4 }],
      visitors: {
        data: [{
          id: 'session-human', browser: 'chrome', os: 'Windows 10', device: 'laptop', screen: '1920x1080', language: 'en-US', country: 'US', region: 'US-AZ', city: 'Phoenix',
          firstAt: '2026-08-01T12:00:00Z', lastAt: '2026-08-01T12:10:00Z', visits: 2, views: 8, events: 3, totaltime: 120,
          activity: [{ createdAt: '2026-08-01T12:00:00Z', urlPath: '/', referrerDomain: null, eventName: null }],
        }, {
          id: 'session-bot', browser: 'ios', os: 'iOS', device: 'mobile', screen: '1920x1080', language: 'en-US@posix', country: 'US', region: 'US-VA', city: 'Ashburn',
          firstAt: '2026-08-01T13:00:00Z', lastAt: '2026-08-01T13:00:00Z', visits: 1, views: 1, events: 0,
          activity: [{ createdAt: '2026-08-01T13:00:00Z', urlPath: '/', referrerDomain: null, eventName: null }],
        }],
      },
      trend: [{ date: '2026-08-01', visitors: 3, visits: 4, pageviews: 8 }],
      retention: [
        { date: '2026-07-01T00:00:00Z', day: 0, visitors: 10, returnVisitors: 10, percentage: 100 },
        { date: '2026-07-01T00:00:00Z', day: 1, visitors: 10, returnVisitors: 2, percentage: 20 },
        { date: '2026-07-01T00:00:00Z', day: 7, visitors: 10, returnVisitors: 1, percentage: 10 },
        { date: '2026-07-02T00:00:00Z', day: 0, visitors: 30, returnVisitors: 30, percentage: 100 },
        { date: '2026-07-02T00:00:00Z', day: 1, visitors: 30, returnVisitors: 15, percentage: 50 },
      ],
    });
    expect(result.stats.bounceRate).toBe(25);
    expect(result.stats.averageDurationSeconds).toBe(2);
    expect(result.topPages).toEqual([{ label: '/work', value: 7 }]);
    expect(result.trend).toEqual([{ date: '2026-08-01', visitors: 3, visits: 4, pageviews: 8 }]);
    expect(result.retention.day1ReturnRate).toBe(42.5);
    expect(result.retention.day7ReturnRate).toBe(10);
    expect(result.retention.cohorts).toEqual([
      { date: '2026-07-01', visitors: 10, day1: 20, day7: 10 },
      { date: '2026-07-02', visitors: 30, day1: 50, day7: null },
    ]);
    expect(result.visitors).toHaveLength(2);
    expect(result.visitors[0]).toMatchObject({ browser: 'chrome', city: 'Phoenix', automation: 'lower', totalTimeSeconds: 120 });
    expect(result.visitors[1]).toMatchObject({ city: 'Ashburn', automation: 'likely', signals: ['One pageview and no tracked interaction', 'Unusual iOS and desktop-sized viewport combination'] });
    expect(result.visitors[0].recordKey).toMatch(/^[A-F0-9]{10}$/);
    expect(JSON.stringify(result)).not.toContain('distinctId');
  });
});
