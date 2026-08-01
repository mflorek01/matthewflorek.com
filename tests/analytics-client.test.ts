import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackAnalyticsEvent } from '../src/lib/analytics/client';

describe('analytics client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not send events when local opt-out is enabled', () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          analyticsMode: 'cookieless'
        }
      }
    });
    const track = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: () => 'true' },
      umami: { track }
    });

    expect(trackAnalyticsEvent('ai_question_submitted', { result: 'completed' })).toBe(false);
    expect(track).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sends only sanitized categorical properties', () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          analyticsMode: 'cookieless'
        }
      }
    });
    const track = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null },
      location: { pathname: '/work' },
      umami: { track }
    });

    expect(trackAnalyticsEvent('project_opened', { slug: 'Grant Dashboard' })).toBe(true);
    expect(track).toHaveBeenCalledWith('project_opened', { slug: 'grant-dashboard' });
    vi.unstubAllGlobals();
  });

  it('does not send a pre-consent event', () => {
    vi.stubGlobal('document', {
      documentElement: {
        dataset: {
          analyticsMode: 'consent'
        }
      }
    });
    const track = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null },
      location: { pathname: '/work' },
      umami: { track }
    });

    expect(trackAnalyticsEvent('tab_viewed', { tab: 'overview' })).toBe(false);
    expect(track).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('does not send events from the private admin area', () => {
    vi.stubGlobal('document', {
      documentElement: { dataset: { analyticsMode: 'cookieless' } }
    });
    const track = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null },
      location: { pathname: '/admin/analytics' },
      umami: { track }
    });

    expect(trackAnalyticsEvent('tab_viewed', { tab: 'overview' })).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });
});
