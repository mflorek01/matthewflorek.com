import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('root layout analytics runtime contract', () => {
  it('forces request-time rendering and exposes only safe analytics data attributes', () => {
    const layoutSource = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

    expect(layoutSource).toContain("export const dynamic = 'force-dynamic';");
    expect(layoutSource).toContain('data-analytics-mode={analyticsMode}');
    expect(layoutSource).toContain('data-umami-script-url={analyticsConfig?.scriptUrl}');
    expect(layoutSource).toContain('data-umami-website-id={analyticsConfig?.websiteId}');
    expect(layoutSource).toContain('data-umami-domains={analyticsConfig?.domains}');
    expect(layoutSource).not.toContain('OPENAI_API_KEY');
    expect(layoutSource).not.toContain('AUTH_SESSION_SECRET');
  });
});
