import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <span>Matthew Florek · Practical data systems and software</span>
          <a href="/privacy">Privacy &amp; analytics</a>
        </div>
      </footer>
    </>
  );
}
