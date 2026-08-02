'use client';

import { useCallback, useEffect, useState } from 'react';

type Result = { error?: string; snapshotId?: string; summary?: { changedProjects: Array<{ externalProjectId: string; fields: string[] }>; conflicts: Array<{ externalProjectId: string; field: string }>; reviewRequired: boolean } };
type Overview = { state?: { status: string; lastStartedAt?: string | null; lastFinishedAt?: string | null; lastSnapshotId?: string | null; errorMessage?: string | null }; snapshot?: { id: string; sourceVersion: string; sourceHash: string; importedAt: string; projectLinks: Array<{ id: string; externalProjectId: string; importedTitle?: string | null; projectId?: string | null; importedPayload: { diff?: Array<{ field: string }>; conflicts?: Array<{ field: string }>; reviewRequired?: boolean }; project?: { override?: { fields: Record<string, unknown> } | null } | null }> } | null };

export function MetamorphysisSyncPanel() {
  const [token, setToken] = useState('');
  const [json, setJson] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!token) return;
    const response = await fetch('/api/admin/integrations/metamorphysis', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    setOverview(await response.json() as Overview);
  }, [token]);

  useEffect(() => { if (token) void loadOverview(); }, [loadOverview, token]);

  async function run(mode: 'manual' | 'remote') {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/integrations/metamorphysis', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(mode === 'remote' ? { mode } : { mode, json }) });
      setResult(await response.json() as Result);
      await loadOverview();
    } catch { setResult({ error: 'The sync request failed before a response was received.' }); }
    finally { setBusy(false); }
  }

  async function approve(externalProjectId: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/admin/integrations/metamorphysis/approve', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ externalProjectId, snapshotId: overview?.snapshot?.id }) });
      setResult(await response.json() as Result);
      await loadOverview();
    } finally { setBusy(false); }
  }

  return <section className="page-section">
    <h1>Metamorphysis sync</h1>
    <p className="lede">Import a bounded, read-only project export. Imports stay private or need review until you approve them for local editing.</p>
    <label className="field-label" htmlFor="admin-token">Admin token</label>
    <input id="admin-token" className="text-input" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
    <label className="field-label" htmlFor="metamorphysis-json">Manual export JSON</label>
    <textarea id="metamorphysis-json" className="text-area" value={json} onChange={(event) => setJson(event.target.value)} placeholder={'{"sourceVersion":"...","projects":[]}' } />
    <div className="button-row"><button className="button button-primary" disabled={busy || !json} onClick={() => run('manual')}>{busy ? 'Syncing…' : 'Import JSON'}</button><button className="button button-secondary" disabled={busy} onClick={() => run('remote')}>Fetch configured export</button></div>
    {result && <pre className="result-panel">{JSON.stringify(result, null, 2)}</pre>}
    <div className="button-row"><button className="button button-secondary" disabled={!token || busy} onClick={() => void loadOverview()}>Refresh sync status</button></div>
    {overview?.state && <div className="result-panel"><strong>Last sync</strong><p>Status: {overview.state.status}</p><p>Finished: {overview.state.lastFinishedAt ?? 'Not yet'}</p>{overview.state.errorMessage && <p>Error: {overview.state.errorMessage}</p>}</div>}
    {overview?.snapshot && <div className="project-grid">{overview.snapshot.projectLinks.map((link) => <article className="project-card" key={link.id}><h2>{link.importedTitle ?? link.externalProjectId}</h2><p>Source ID: {link.externalProjectId}</p><p>Changed fields: {link.importedPayload.diff?.map((change) => change.field).join(', ') || 'None detected'}</p><p>Conflicts: {link.importedPayload.conflicts?.map((conflict) => conflict.field).join(', ') || 'None'}</p><p>Local overrides: {Object.keys(link.project?.override?.fields ?? {}).join(', ') || 'None'}</p>{link.importedPayload.reviewRequired && <p><strong>Review required</strong></p>}{link.projectId && <button className="button button-secondary" disabled={busy} onClick={() => void approve(link.externalProjectId)}>Approve for local editing</button>}</article>)}</div>}
  </section>;
}
