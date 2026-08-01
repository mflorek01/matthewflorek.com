'use client';

import { useState } from 'react';
import {
  getAnalyticsMode,
  isAnalyticsDisabled,
  setAnalyticsDisabled
} from '@/lib/analytics/config';

export function TrackingPreference() {
  const [disabled, setDisabled] = useState(() => isAnalyticsDisabled());
  const mode = getAnalyticsMode();

  if (mode === 'off') {
    return <p>Anonymous analytics is disabled by the site configuration.</p>;
  }

  function toggle() {
    const next = !disabled;
    setAnalyticsDisabled(next);
    setDisabled(next);
  }

  return (
    <div>
      <button type="button" onClick={toggle} aria-pressed={!disabled}>
        {disabled
          ? mode === 'consent'
            ? 'Allow anonymous analytics'
            : 'Enable anonymous analytics'
          : 'Disable anonymous analytics'}
      </button>
      <p aria-live="polite">
        {disabled
          ? 'Analytics is currently off in this browser.'
          : 'Anonymous analytics is currently enabled in this browser.'}
      </p>
    </div>
  );
}
