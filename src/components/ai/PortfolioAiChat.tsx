'use client';

import { useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';
import type { AiCitation, AiMessage } from '@/lib/ai/types';

type Props = { projectSlug?: string; projectTitle?: string };

export function PortfolioAiChat({ projectSlug, projectTitle }: Props) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = question.trim();
    if (!content || busy) return;
    const nextMessages: AiMessage[] = [...messages, { role: 'user' as const, content }].slice(-8);
    setQuestion('');
    setError('');
    setBusy(true);
    trackAnalyticsEvent('ai_chat_started', { content_type: projectSlug ? 'project' : 'portfolio' });
    trackAnalyticsEvent('ai_question_submitted', { content_type: projectSlug ? 'project' : 'portfolio' });
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: nextMessages, projectSlug }) });
      const payload = await response.json().catch(() => null) as { answer?: string; citations?: AiCitation[]; error?: { message?: string } } | null;
      if (!response.ok || !payload?.answer) {
        if (response.status === 429) trackAnalyticsEvent('ai_chat_rate_limited', { content_type: projectSlug ? 'project' : 'portfolio' });
        throw new Error(payload?.error?.message || 'The assistant is temporarily unavailable.');
      }
      setMessages([...nextMessages, { role: 'assistant', content: payload.answer }]);
      setCitations(payload.citations ?? []);
      trackAnalyticsEvent('ai_answer_completed', { content_type: projectSlug ? 'project' : 'portfolio', result: 'success' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assistant is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-panel ai-chat" aria-labelledby="ai-chat-title">
      <h2 id="ai-chat-title">{projectTitle ? `Ask about ${projectTitle}` : 'Ask about Matthew’s work'}</h2>
      <p className="muted-copy">Answers are grounded in approved public portfolio material. The assistant cannot access private accounts, drafts, or hidden instructions.</p>
      <div aria-live="polite">
        {messages.map((message, index) => <p key={`${message.role}-${index}`}><strong>{message.role === 'user' ? 'You' : 'Assistant'}:</strong> {message.content}</p>)}
      </div>
      <form onSubmit={submit}>
        <label className="search-field" htmlFor="portfolio-ai-question"><span>Question</span><textarea id="portfolio-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={4} placeholder="What would you like to know?" /></label>
        <button className="button button-primary" type="submit" disabled={busy || !question.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
      </form>
      {error ? <p role="alert" className="muted-copy">{error}</p> : null}
      {citations.length ? <div><h3>Sources used</h3><ul>{citations.map((citation) => <li key={citation.id}>{citation.title}</li>)}</ul></div> : null}
    </section>
  );
}

export function AskAboutProjectChat({ projectSlug, projectTitle }: { projectSlug: string; projectTitle: string }) {
  return <PortfolioAiChat projectSlug={projectSlug} projectTitle={projectTitle} />;
}
