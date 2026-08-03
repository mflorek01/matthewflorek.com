import { getAuthenticatedAdmin } from '@/lib/auth';
import { getAiSettingsStatus } from '@/lib/ai/settings';
import { listKnowledgeDocuments } from '@/lib/ai/knowledge-admin';
import { redirect } from 'next/navigation';
import { SettingsPanel } from './SettingsPanel';
import { KnowledgeDocumentsPanel } from './KnowledgeDocumentsPanel';

export const metadata = { title: 'AI Assistant Controls | Matthew Florek', robots: { index: false, follow: false } };

export default async function AiAdminPage() {
  if (!await getAuthenticatedAdmin()) redirect('/admin/login');
  const [status, documents] = await Promise.all([getAiSettingsStatus(), listKnowledgeDocuments()]);
  return <main className="shell page-section"><h1>Public assistant controls</h1><p className="page-lede">The assistant can answer only from published projects/pages and knowledge documents explicitly marked PUBLIC and includeInAi.</p><div className="content-panel" style={{ maxWidth: 720, marginTop: 32 }}><p><strong>Status:</strong> {status.enabled ? 'enabled' : 'disabled'}</p><p><strong>Credential:</strong> {status.configured ? `configured${status.apiKeyLastFour ? ` (ending ${status.apiKeyLastFour})` : ''}` : 'not configured'}</p><p><strong>Model:</strong> {status.model ?? 'not configured'}</p><p className="muted-copy">Credentials are encrypted at rest and are never displayed. Knowledge documents stay private until you explicitly publish them.</p></div><SettingsPanel initial={status} /><KnowledgeDocumentsPanel initial={documents.map((document) => ({ ...document, updatedAt: document.updatedAt.toISOString() }))} /></main>;
}
