'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeAdminRedirect } from '@/lib/auth/redirect';

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function responseError(response: Response, fallback: string) {
    const body = await response.json().catch(() => null) as { error?: unknown } | null;
    return typeof body?.error === 'string' ? body.error : fallback;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
    if (!response.ok) {
      setError(await responseError(response, 'Unable to sign in'));
      setBusy(false);
      return;
    }
    window.location.assign(safeAdminRedirect(searchParams.get('next')));
  }

  return <main className="admin-login"><div className="admin-card"><h1>Portfolio CMS</h1><p>Sign in to edit drafts and publish approved changes.</p><form onSubmit={submit} className="admin-form"><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-button admin-button-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></div></main>;
}
