import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';
import { UmamiScript } from '@/components/analytics/UmamiScript';
import './globals.css';

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
  return (
    <html lang={siteConfig.locale}>
      <body><UmamiScript />{children}</body>
    </html>
  );
}
