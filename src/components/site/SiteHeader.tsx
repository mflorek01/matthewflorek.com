'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';

const navigation = [
  { href: '/', label: 'Overview', tab: 'overview' },
  { href: '/work', label: 'Work Projects', tab: 'work' },
  { href: '/ai', label: 'AI Projects', tab: 'ai' }
] as const;

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function closeMenu() {
    setOpen(false);
  }

  function selectTab(tab: (typeof navigation)[number]['tab']) {
    trackAnalyticsEvent('tab_viewed', { tab });
    closeMenu();
  }

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" onClick={closeMenu} aria-label="Matthew Florek home">
          <span className="brand-mark" aria-hidden="true">MF</span>
          <span>Matthew Florek</span>
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="sr-only">Toggle navigation</span>
          <span aria-hidden="true">{open ? 'Close' : 'Menu'}</span>
        </button>
        <nav id="primary-navigation" className={`primary-nav${open ? ' is-open' : ''}`} aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => selectTab(item.tab)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
