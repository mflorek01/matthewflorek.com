'use client';

import { useEffect, useState } from 'react';
import { getAnalyticsConfig, isAnalyticsDisabled } from '@/lib/analytics/config';

export function UmamiScript({ enabled = true }: { enabled?: boolean }) {
  const config = getAnalyticsConfig();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const refresh = () => setAllowed(!isAnalyticsDisabled());
    refresh();
    window.addEventListener('portfolio-analytics-preference-changed', refresh);
    return () => window.removeEventListener('portfolio-analytics-preference-changed', refresh);
  }, []);

  useEffect(() => {
    if (!enabled || !config || !allowed) return;

    const script = document.createElement('script');
    script.src = config.scriptUrl;
    script.async = true;
    script.defer = true;
    script.dataset.websiteId = config.websiteId;
    if (config.domains) script.dataset.domains = config.domains;
    script.dataset.autoTrack = 'true';
    document.head.appendChild(script);

    return () => {
      script.remove();
      delete window.umami;
    };
  }, [allowed, config, enabled]);

  return null;
}
