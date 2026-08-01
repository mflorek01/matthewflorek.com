'use client';

import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';
import type { AnalyticsEventName, AnalyticsProperties } from '@/lib/analytics/events';

type TrackedButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & {
  event: AnalyticsEventName;
  properties?: AnalyticsProperties;
}>;

export function TrackedButton({ event, properties, onClick, ...props }: TrackedButtonProps) {
  return (
    <button
      {...props}
      onClick={(clickEvent) => {
        trackAnalyticsEvent(event, properties);
        onClick?.(clickEvent);
      }}
    />
  );
}
