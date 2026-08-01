'use client';

import { useState } from 'react';
import { PortfolioAiChat } from '@/components/ai/PortfolioAiChat';
import { TrackedButton } from '@/components/analytics/TrackedButton';

export function AskAboutProject({
  projectSlug,
  projectTitle,
  enabled
}: {
  projectSlug: string;
  projectTitle: string;
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <div className="ask-panel">
      <TrackedButton
        type="button"
        className="button button-secondary"
        event="ai_chat_started"
        properties={{ content_type: 'project' }}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? 'Close project chat' : 'Ask about this project'} <span aria-hidden="true">*</span>
      </TrackedButton>
      {open ? <PortfolioAiChat projectSlug={projectSlug} projectTitle={projectTitle} /> : null}
    </div>
  );
}
