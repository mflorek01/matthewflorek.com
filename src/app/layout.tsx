import type { Metadata } from 'next';
import { getAnalyticsConfig, getAnalyticsMode } from '@/lib/analytics/config';
import { siteConfig } from '@/lib/site-config';
import { UmamiScript } from '@/components/analytics/UmamiScript';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://matthewflorek.com'),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: 'website',
    url: 'https://matthewflorek.com'
  },
  twitter: { card: 'summary' },
  robots: { index: true, follow: true }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const analyticsConfig = getAnalyticsConfig();
  const analyticsMode = getAnalyticsMode();

  return (
    <html
      lang={siteConfig.locale}
      data-analytics-mode={analyticsMode}
      data-umami-script-url={analyticsConfig?.scriptUrl}
      data-umami-website-id={analyticsConfig?.websiteId}
      data-umami-domains={analyticsConfig?.domains}
    >
      <body><UmamiScript />{children}</body>
    </html>
  );
}
