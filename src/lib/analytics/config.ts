export const analyticsPreferenceStorageKey = 'portfolio-analytics-preference';
export const analyticsDisabledStorageKey = 'portfolio-analytics-disabled';

export type AnalyticsMode = 'off' | 'cookieless' | 'consent';
export type AnalyticsPreference = 'opt-in' | 'opt-out';

export type AnalyticsRuntimeConfig = Readonly<{
  mode: AnalyticsMode;
  scriptUrl: string;
  websiteId: string;
  domains?: string;
}>;

export type AnalyticsConfig = Readonly<{
  scriptUrl: string;
  websiteId: string;
  mode: Exclude<AnalyticsMode, 'off'>;
  domains?: string;
}>;

const analyticsModeValues = new Set<AnalyticsMode>(['off', 'cookieless', 'consent']);

function readDocumentDatasetValue(key: keyof DOMStringMap) {
  if (typeof document === 'undefined') return '';
  return document.documentElement.dataset[key]?.trim() ?? '';
}

function readEnvValue(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim() ?? '';
    if (value) return value;
  }
  return '';
}

function readAnalyticsMode(): AnalyticsMode {
  const configured = readDocumentDatasetValue('analyticsMode') || readEnvValue(['ANALYTICS_MODE', 'NEXT_PUBLIC_ANALYTICS_MODE']);
  return configured === 'cookieless' || configured === 'consent' ? configured : 'off';
}

export function getAnalyticsMode(): AnalyticsMode {
  return readAnalyticsMode();
}

function readAnalyticsRuntimeConfig(): AnalyticsRuntimeConfig | null {
  const modeCandidate = readDocumentDatasetValue('analyticsMode') || readEnvValue(['ANALYTICS_MODE', 'NEXT_PUBLIC_ANALYTICS_MODE']);
  const mode = analyticsModeValues.has(modeCandidate as AnalyticsMode) ? (modeCandidate as AnalyticsMode) : 'off';
  const scriptUrl = readDocumentDatasetValue('umamiScriptUrl') || readEnvValue(['UMAMI_SCRIPT_URL', 'NEXT_PUBLIC_UMAMI_SCRIPT_URL']);
  const websiteId = readDocumentDatasetValue('umamiWebsiteId') || readEnvValue(['UMAMI_WEBSITE_ID', 'NEXT_PUBLIC_UMAMI_WEBSITE_ID']);
  const domains = readDocumentDatasetValue('umamiDomains') || readEnvValue(['UMAMI_DOMAINS', 'NEXT_PUBLIC_UMAMI_DOMAINS']);

  if (mode === 'off' || !scriptUrl || !websiteId) return null;

  try {
    const parsedUrl = new URL(scriptUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
  } catch {
    return null;
  }

  return domains ? { scriptUrl, websiteId, mode, domains } : { scriptUrl, websiteId, mode };
}

export function getAnalyticsConfig(): AnalyticsConfig | null {
  const runtimeConfig = readAnalyticsRuntimeConfig();
  if (!runtimeConfig) return null;
  const { mode, scriptUrl, websiteId, domains } = runtimeConfig;
  if (mode === 'off' || !scriptUrl || !websiteId) return null;
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

export function isAnalyticsExcludedPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/');
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
