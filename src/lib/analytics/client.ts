import { isAnalyticsDisabled, isAnalyticsExcludedPath } from './config';
import { sanitizeAnalyticsEvent, type AnalyticsEvent, type AnalyticsProperties } from './events';

type UmamiClient = {
  track: (eventName: string, properties?: AnalyticsProperties) => void;
};

declare global {
  interface Window {
    umami?: UmamiClient;
  }
}

export function trackAnalyticsEvent(name: AnalyticsEvent['name'], properties?: AnalyticsProperties) {
  if (typeof window === 'undefined' || isAnalyticsDisabled() || isAnalyticsExcludedPath(window.location.pathname)) return false;

  const event = sanitizeAnalyticsEvent({ name, properties });
  if (!event || !window.umami) return false;

  try {
    window.umami.track(event.name, event.properties);
    return true;
  } catch {
    return false;
  }
}
