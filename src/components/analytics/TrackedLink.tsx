'use client';

import type { MouseEventHandler, PropsWithChildren } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';
import type { AnalyticsProperties } from '@/lib/analytics/events';

type TrackedLinkProps = PropsWithChildren<{
  href: string;
  event: 'project_source_clicked' | 'github_profile_clicked' | 'resume_downloaded' | 'contact_cta_clicked' | 'external_link_clicked';
  properties?: AnalyticsProperties;
  className?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
}>;

export function TrackedLink({ event, properties, onClick, ...props }: TrackedLinkProps & { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <a
      {...props}
      onClick={(clickEvent) => {
        trackAnalyticsEvent(event, properties);
        onClick?.(clickEvent);
      }}
    />
  );
}
