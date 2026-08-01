export const analyticsPreferenceStorageKey = 'portfolio-analytics-preference';
export const analyticsDisabledStorageKey = 'portfolio-analytics-disabled';

export type AnalyticsMode = 'off' | 'cookieless' | 'consent';
export type AnalyticsPreference = 'opt-in' | 'opt-out';

export type AnalyticsConfig = Readonly<{
  scriptUrl: string;
  websiteId: string;
  mode: Exclude<AnalyticsMode, 'off'>;
  domains?: string;
}>;

function readAnalyticsMode(): AnalyticsMode {
  const configured = process.env.NEXT_PUBLIC_ANALYTICS_MODE?.trim().toLowerCase();
  return configured === 'cookieless' || configured === 'consent' ? configured : 'off';
}

export function getAnalyticsMode(): AnalyticsMode {
  if (typeof process === 'undefined') return 'off';
  return readAnalyticsMode();
}

export function getAnalyticsConfig(): AnalyticsConfig | null {
  const mode = getAnalyticsMode();
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() ?? '';
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim() ?? '';
  if (mode === 'off' || !scriptUrl || !websiteId) return null;

  try {
    const parsedUrl = new URL(scriptUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
  } catch {
    return null;
  }

  const domains = process.env.NEXT_PUBLIC_UMAMI_DOMAINS?.trim() ?? '';
  return domains ? { scriptUrl, websiteId, mode, domains } : { scriptUrl, websiteId, mode };
}

export function getAnalyticsPreference(): AnalyticsPreference | null {
  if (typeof window === 'undefined') return null;
  try {
    const preference = window.localStorage.getItem(analyticsPreferenceStorageKey);
    if (preference === 'opt-in' || preference === 'opt-out') return preference;

    // Migrate the previous local opt-out without treating it as consent.
    if (window.localStorage.getItem(analyticsDisabledStorageKey) === 'true') return 'opt-out';
    return null;
  } catch {
    return null;
  }
}

export function isAnalyticsDisabled() {
  const mode = getAnalyticsMode();
  const preference = getAnalyticsPreference();
  if (mode === 'off') return true;
  if (preference === 'opt-out') return true;
  return mode === 'consent' && preference !== 'opt-in';
}

export function setAnalyticsPreference(preference: AnalyticsPreference | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(analyticsDisabledStorageKey);
    if (preference) window.localStorage.setItem(analyticsPreferenceStorageKey, preference);
    else window.localStorage.removeItem(analyticsPreferenceStorageKey);
    window.dispatchEvent(new CustomEvent('portfolio-analytics-preference-changed'));
  } catch {
    // Storage/events can be unavailable in privacy modes; analytics remains off for consent mode.
  }
}

export function setAnalyticsDisabled(disabled: boolean) {
  setAnalyticsPreference(disabled ? 'opt-out' : 'opt-in');
}
