import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAnalyticsConfig,
  getAnalyticsMode,
  getAnalyticsPreference,
  isAnalyticsDisabled,
  isAnalyticsExcludedPath,
  setAnalyticsDisabled
} from '../src/lib/analytics/config';

describe('analytics configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reads runtime analytics config from server env', () => {
    vi.stubEnv('ANALYTICS_MODE', 'consent');
    vi.stubEnv('UMAMI_SCRIPT_URL', 'https://analytics.example.com/script.js');
    vi.stubEnv('UMAMI_WEBSITE_ID', 'site-id');
    vi.stubEnv('UMAMI_DOMAINS', 'matthewflorek.com');

    expect(getAnalyticsMode()).toBe('consent');
    expect(getAnalyticsConfig()).toEqual({
      scriptUrl: 'https://analytics.example.com/script.js',
      websiteId: 'site-id',
      mode: 'consent',
      domains: 'matthewflorek.com'
    });
  });

  it('falls back to legacy NEXT_PUBLIC analytics values when runtime names are absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'cookieless');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', 'https://analytics.example.com/script.js');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'site-id');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_DOMAINS', 'matthewflorek.com');

    expect(getAnalyticsMode()).toBe('cookieless');
    expect(getAnalyticsConfig()).toEqual({
      scriptUrl: 'https://analytics.example.com/script.js',
      websiteId: 'site-id',
      mode: 'cookieless',
      domains: 'matthewflorek.com'
    });
  });

  it('prefers runtime-visible html data attributes in the browser', () => {
    vi.stubEnv('ANALYTICS_MODE', 'off');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'cookieless');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', 'https://build.example.com/script.js');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'build-site');
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          analyticsMode: 'consent',
          umamiScriptUrl: 'https://analytics.example.com/script.js',
          umamiWebsiteId: 'site-id',
          umamiDomains: 'matthewflorek.com'
        }
      }
    });

    expect(getAnalyticsMode()).toBe('consent');
    expect(getAnalyticsConfig()).toEqual({
      scriptUrl: 'https://analytics.example.com/script.js',
      websiteId: 'site-id',
      mode: 'consent',
      domains: 'matthewflorek.com'
    });
  });

  it('is disabled when required public configuration is absent', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'cookieless');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', undefined);
    expect(getAnalyticsConfig()).toBeNull();
  });

  it('defaults to off and only accepts explicit analytics modes', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', undefined);
    expect(getAnalyticsMode()).toBe('off');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'unexpected');
    expect(getAnalyticsMode()).toBe('off');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'cookieless');
    expect(getAnalyticsMode()).toBe('cookieless');
  });

  it('rejects invalid script URLs and supports optional domains', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'cookieless');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', 'javascript:alert(1)');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'site-id');
    expect(getAnalyticsConfig()).toBeNull();

    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', 'https://analytics.example.com/script.js');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_DOMAINS', 'matthewflorek.com');
    expect(getAnalyticsConfig()).toEqual({
      scriptUrl: 'https://analytics.example.com/script.js',
      websiteId: 'site-id',
      mode: 'cookieless',
      domains: 'matthewflorek.com'
    });
  });

  it('requires opt-in in consent mode and permits cookieless auto mode', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'consent');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', 'https://analytics.example.com/script.js');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'site-id');
    expect(getAnalyticsPreference()).toBeNull();
    expect(isAnalyticsDisabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_MODE', 'cookieless');
    expect(isAnalyticsDisabled()).toBe(false);
  });

  it('fails safely when local storage is unavailable', () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          analyticsMode: 'cookieless'
        }
      }
    });
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('unavailable');
        },
        removeItem: () => {
          throw new Error('unavailable');
        },
        setItem: () => {
          throw new Error('unavailable');
        }
      }
    });

    expect(isAnalyticsDisabled()).toBe(false);
    expect(() => setAnalyticsDisabled(true)).not.toThrow();
  });

  it('excludes private admin routes from portfolio analytics', () => {
    expect(isAnalyticsExcludedPath('/admin')).toBe(true);
    expect(isAnalyticsExcludedPath('/admin/analytics')).toBe(true);
    expect(isAnalyticsExcludedPath('/work')).toBe(false);
  });
});
