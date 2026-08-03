'use client';

import { useState } from 'react';

type DocumentRecord = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  includeInAi: boolean;
  originalName: string | null;
  bytes: number | null;
  updatedAt: string;
};

function formatBytes(bytes: number | null) {
  if (bytes === null) return '';
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function KnowledgeDocumentsPanel({ initial }: { initial: DocumentRecord[] }) {
  const [documents, setDocuments] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function request(method: 'POST' | 'PATCH', body: BodyInit) {
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/admin/ai-knowledge', { method, body, ...(body instanceof FormData ? {} : { headers: { 'content-type': 'application/json' } }) });
      const payload = await response.json().catch(() => null) as { document?: DocumentRecord; documents?: DocumentRecord[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || 'Request failed');
      if (payload?.documents) setDocuments(payload.documents);
      if (payload?.document) setDocuments((items) => items.map((item) => item.id === payload.document?.id ? payload.document : item));
      return payload;
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : 'Request failed');
      return null;
    } finally { setBusy(false); }
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    const form = new FormData(); form.set('file', file); if (title.trim()) form.set('title', title.trim());
    const result = await request('POST', form);
    if (result?.document) { setDocuments((items) => [result.document!, ...items]); setFile(null); setTitle(''); setMessage('Uploaded as a draft. Publish it below when you are ready for the assistant to use it.'); }
  }

  async function setPublished(document: DocumentRecord, published: boolean) {
    await request('PATCH', JSON.stringify({ id: document.id, status: published ? 'PUBLISHED' : 'DRAFT', includeInAi: published }));
  }

  async function archive(document: DocumentRecord) {
    await request('PATCH', JSON.stringify({ id: document.id, status: 'ARCHIVED', includeInAi: false }));
  }

  return <div className="admin-card" style={{ marginTop: 24 }}>
    <div className="admin-card-heading"><h2>AI reference documents</h2><span>{documents.filter((document) => document.status === 'PUBLISHED' && document.includeInAi).length} active</span></div>
    <p className="admin-help-text">Upload plain-text files that the public assistant is allowed to use. Files stay private until you explicitly publish them. Supported formats: TXT, Markdown, CSV, and JSON.</p>
    <form className="admin-form-grid" onSubmit={upload}>
      <label>Document title <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example, Matthew's working philosophy" /></label>
      <label>Choose a document <input type="file" accept=".txt,.md,.markdown,.csv,.json,text/plain,text/markdown,application/json,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
      <div className="admin-actions"><button className="admin-button admin-button-primary" type="submit" disabled={!file || busy}>Upload as draft</button></div>
    </form>
    {documents.length ? <ul className="admin-list" style={{ marginTop: 18 }}>{documents.map((document) => <li key={document.id}>
      <span><strong>{document.title}</strong><span>{document.originalName ?? 'uploaded document'}{document.bytes ? ` · ${formatBytes(document.bytes)}` : ''} · {new Date(document.updatedAt).toLocaleString()}</span></span>
      <span className="admin-actions"><span className="admin-help-text">{document.status === 'PUBLISHED' && document.includeInAi ? 'Active for AI' : document.status === 'ARCHIVED' ? 'Archived' : 'Draft'}</span>{document.status === 'PUBLISHED' && document.includeInAi ? <button className="admin-button admin-button-muted" type="button" disabled={busy} onClick={() => setPublished(document, false)}>Unpublish</button> : <button className="admin-button admin-button-primary" type="button" disabled={busy || document.status === 'ARCHIVED'} onClick={() => setPublished(document, true)}>Publish for AI</button>}{document.status !== 'ARCHIVED' ? <button className="admin-button admin-button-danger" type="button" disabled={busy} onClick={() => archive(document)}>Archive</button> : null}</span>
    </li>)}</ul> : <p className="muted-copy">No reference documents uploaded yet.</p>}
    {message ? <p className={failed ? 'admin-error' : 'admin-notice'} role="status">{message}</p> : null}
  </div>;
}
