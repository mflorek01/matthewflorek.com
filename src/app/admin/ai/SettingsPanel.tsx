'use client';
import { useState } from 'react';

type Status = { configured: boolean; enabled: boolean; apiKeyLastFour: string | null; model: string | null; source: 'database' | 'environment' };

export function SettingsPanel({ initial }: { initial: Status }) {
  const [status, setStatus] = useState(initial); const [apiKey, setApiKey] = useState(''); const [model, setModel] = useState(initial.model ?? ''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [failed, setFailed] = useState(false);
  async function request(method: string, body?: unknown) {
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/admin/ai-settings', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data: unknown = await response.json();
      const result = typeof data === 'object' && data !== null ? data as { configured?: boolean; tested?: boolean; error?: unknown } : {};
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Request failed');
      if (result.configured !== undefined) setStatus(data as Status);
      setApiKey(''); setMessage(result.tested ? 'Credential verified.' : 'Saved.');
    }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Request failed'); } finally { setBusy(false); }
  }
  return <div className="admin-editor">
    <div className="admin-card"><h2>Credential</h2><p><strong>{status.configured ? `Configured${status.apiKeyLastFour ? ` · ending ${status.apiKeyLastFour}` : ''}` : 'Not configured'}</strong> · {status.source === 'database' ? 'managed here' : 'environment fallback'}</p><label>OpenAI API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={status.configured ? 'Enter a replacement key' : 'sk-…'} autoComplete="off" /></label><label>Model<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-5.6-luna" /></label><div className="admin-actions"><button className="admin-button admin-button-primary" disabled={busy || (!apiKey && !model)} onClick={() => request('PUT', { ...(apiKey ? { apiKey } : {}), model })}>Save and verify</button><button className="admin-button admin-button-muted" disabled={busy || !status.configured} onClick={() => request('POST', { action: 'test', ...(apiKey ? { apiKey } : {}) })}>Test credential</button><button className="admin-button admin-button-danger" disabled={busy || !status.configured} onClick={() => request('DELETE')}>Remove</button></div></div>
    <div className="admin-card"><h2>Availability</h2><p>The public assistant is <strong>{status.enabled ? 'enabled' : 'disabled'}</strong>.</p><button className="admin-button admin-button-muted" disabled={busy || !status.configured} onClick={() => request('PATCH', { enabled: !status.enabled })}>{status.enabled ? 'Disable assistant' : 'Enable assistant'}</button></div>
    {message ? <p className={failed ? 'admin-error' : 'admin-notice'} role="status">{message}</p> : null}
  </div>;
}
