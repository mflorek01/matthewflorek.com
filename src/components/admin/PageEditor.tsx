'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Block = { id: string; blockKey: string; kind: string; sortOrder: number; visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED'; includeInAi: boolean; data: unknown };
type EditableBlock = Block & { dataText: string };
type Page = { id: string; title: string; isPublished: boolean; blocks: Block[]; revisions: Array<{ id: string; version: number; status: string; createdAt: Date | string }> };

function clientId() { return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }

function SortableBlock({ block, index, onChange, onRemove }: { block: EditableBlock; index: number; onChange: (patch: Partial<EditableBlock>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="admin-block"><div className="admin-block-heading"><strong>{index + 1}. {block.blockKey}</strong><span>{block.kind}</span></div><div className="admin-form-grid"><label>Block key<input value={block.blockKey} onChange={(event) => onChange({ blockKey: event.target.value })} /></label><label>Kind<input value={block.kind} onChange={(event) => onChange({ kind: event.target.value })} /></label><label>Visibility<select value={block.visibility} onChange={(event) => onChange({ visibility: event.target.value as Block['visibility'] })}><option>PUBLIC</option><option>UNLISTED</option><option>PRIVATE</option></select></label><label className="admin-checkbox"><input type="checkbox" checked={block.includeInAi} onChange={(event) => onChange({ includeInAi: event.target.checked })} /> Include in AI knowledge</label></div><label>Copy/data JSON<textarea rows={8} value={block.dataText} onChange={(event) => onChange({ dataText: event.target.value })} /></label><div className="admin-inline-actions"><button type="button" className="drag-handle" {...attributes} {...listeners}>↕ Reorder</button><button type="button" className="admin-button admin-button-danger" onClick={onRemove}>Remove block</button></div></div>;
}

export function PageEditor({ page }: { page: Page }) {
  const [title, setTitle] = useState(page.title);
  const [blocks, setBlocks] = useState<EditableBlock[]>(page.blocks.map((block) => ({ ...block, dataText: JSON.stringify(block.data, null, 2) })));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function responseError(response: Response, fallback: string) { const body = await response.json().catch(() => null) as { error?: unknown } | null; return typeof body?.error === 'string' ? body.error : fallback; }
  function updateBlock(id: string, patch: Partial<EditableBlock>) { setBlocks((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function onDragEnd(event: DragEndEvent) { const { active, over } = event; if (!over || active.id === over.id) return; setBlocks((items) => { const oldIndex = items.findIndex((item) => item.id === active.id); const newIndex = items.findIndex((item) => item.id === over.id); return arrayMove(items, oldIndex, newIndex); }); }
  function addBlock() { setBlocks((items) => [...items, { id: clientId(), blockKey: `block-${items.length + 1}`, kind: 'text', sortOrder: items.length, visibility: 'PRIVATE', includeInAi: false, data: {}, dataText: '{\n  "text": ""\n}' }]); }
  async function restore(revisionId: string) { setBusy(true); setMessage(''); try { const response = await fetch(`/api/admin/pages/${page.id}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId }) }); if (!response.ok) throw new Error(await responseError(response, 'Unable to restore revision')); setMessage('Revision restored into a new draft.'); window.location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to restore revision'); } finally { setBusy(false); } }
  async function save(publish = false) {
    setBusy(true); setMessage('');
    try {
      const parsedBlocks = blocks.map(({ dataText, ...block }, sortOrder) => ({ ...block, sortOrder, data: JSON.parse(dataText) as unknown }));
      const saveResponse = await fetch(`/api/admin/pages/${page.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, blocks: parsedBlocks }) });
      if (!saveResponse.ok) throw new Error(await responseError(saveResponse, 'Unable to save draft'));
      if (publish) { const publishResponse = await fetch(`/api/admin/pages/${page.id}/publish`, { method: 'POST' }); if (!publishResponse.ok) throw new Error(await responseError(publishResponse, 'Unable to publish')); }
      setMessage(publish ? 'Published successfully.' : 'Draft saved. Public content is unchanged.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save'); }
    finally { setBusy(false); }
  }

  return <div><div className="admin-heading"><div><Link href="/admin" className="admin-back">← Workspace</Link><p className="admin-kicker">Page editor</p><h1>{page.title}</h1></div><div className="admin-actions"><Link className="admin-button admin-button-muted" href="/?preview=1" target="_blank">Preview draft</Link><button className="admin-button admin-button-muted" onClick={() => save()} disabled={busy}>Save draft</button><button className="admin-button admin-button-primary" onClick={() => save(true)} disabled={busy}>Publish</button></div></div>{message && <p className="admin-notice" role="status">{message}</p>}<div className="admin-card admin-editor"><label>Page title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="admin-card-heading"><h2>Inline blocks</h2><button type="button" className="admin-button admin-button-muted" onClick={addBlock}>Add block</button></div><DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>{blocks.map((block, index) => <SortableBlock key={block.id} block={{ ...block, sortOrder: index }} index={index} onChange={(patch) => updateBlock(block.id, patch)} onRemove={() => setBlocks((items) => items.filter((item) => item.id !== block.id))} />)}</SortableContext></DndContext></div><div className="admin-card"><h2>Revision history</h2><ul className="admin-list">{page.revisions.map((revision) => <li key={revision.id}><span><strong>Version {revision.version}</strong><span>{revision.status}</span></span><span>{new Date(revision.createdAt).toLocaleString()} <button type="button" className="admin-button admin-button-muted" onClick={() => restore(revision.id)} disabled={busy}>Restore as draft</button></span></li>)}</ul></div></div>;
}
