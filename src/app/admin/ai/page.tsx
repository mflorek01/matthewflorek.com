import { getAiConfig } from '@/lib/ai/config';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'AI Assistant Controls | Matthew Florek', robots: { index: false, follow: false } };

export default async function AiAdminPage() {
  if (!await getAuthenticatedAdmin()) redirect('/admin/login');
  const config = getAiConfig();
  return (
    <main className="shell page-section">
      <p className="eyebrow">Admin · AI assistant</p>
      <h1>Public assistant controls</h1>
      <p className="page-lede">The assistant can answer only from published projects/pages and knowledge documents explicitly marked PUBLIC and includeInAi.</p>
      <div className="content-panel" style={{ maxWidth: 720, marginTop: 32 }}>
        <p><strong>Status:</strong> {config.enabled ? 'configured' : `disabled (${config.disabledReason ?? 'configuration error'})`}</p>
        <p><strong>Model:</strong> {config.model ?? 'not configured'}</p>
        <p><strong>Hosted retrieval:</strong> {config.publicVectorStoreConfirmed && config.publicVectorStoreId ? 'configured with the explicitly designated public-only vector store' : 'disabled; local approved evidence is used'}</p>
        <p className="muted-copy">Knowledge documents are managed through the reviewed server-side publication workflow. This page exposes status only; it does not provide knowledge upload or publishing controls.</p>
      </div>
    </main>
  );
}
