'use client';

import { useId, useState, type ReactNode } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';
import type { AiCitation, AiMessage } from '@/lib/ai/types';
import styles from './PortfolioAiChat.module.css';

type Props = { projectSlug?: string; projectTitle?: string };

function formatInline(text: string, citations: AiCitation[], citationPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[E\d+\])/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    const marker = /^\[E(\d+)\]$/.exec(part);
    if (!marker) return <span key={`${part}-${index}`}>{part}</span>;
    const evidenceNumber = Number(marker[1]);
    const citation = citations[evidenceNumber - 1];
    if (!citation) return <span key={`${part}-${index}`}>{part}</span>;
    const href = citation.sourceUrl || `#${citationPrefix}-${evidenceNumber}`;
    return (
      <a
        className={styles.citationMarker}
        href={href}
        key={`${part}-${index}`}
        aria-label={`${part} ${citation.title}`}
        {...(citation.sourceUrl ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {part}
      </a>
    );
  });
}

function FormattedMessage({ content, citations, citationPrefix }: { content: string; citations: AiCitation[]; citationPrefix: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(<p key={`paragraph-${blocks.length}`}>{formatInline(paragraph.join(' '), citations, citationPrefix)}</p>);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push(<ul key={`list-${blocks.length}`}>{list.map((item, index) => <li key={`${item}-${index}`}>{formatInline(item, citations, citationPrefix)}</li>)}</ul>);
      list = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (/^(?:[-*]|\d+\.)\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^(?:[-*]|\d+\.)\s+/, ''));
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();
  return <>{blocks}</>;
}

export function PortfolioAiChat({ projectSlug, projectTitle }: Props) {
  const citationPrefix = `ai-source-${useId().replace(/:/g, '')}`;
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
    setMessages(nextMessages);
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
      setError(caught instanceof TypeError ? 'I could not reach the assistant. Please try again in a moment.' : caught instanceof Error ? caught.message : 'The assistant is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  function startNewConversation() {
    if (busy) return;
    setMessages([]);
    setCitations([]);
    setError('');
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section className={styles.chat} aria-label={projectTitle ? `Ask about ${projectTitle}` : 'Ask about Matthew’s work'}>
      {messages.length ? <div className={styles.chatControls}><button className={styles.newConversation} type="button" onClick={startNewConversation} disabled={busy}>New conversation</button></div> : null}

      <div className={styles.transcript} aria-live="polite" aria-busy={busy}>
        {!messages.length && !busy ? <div className={styles.emptyState}><p>Ask me about Matthew’s work, projects, or experience.</p><span>Try “What kind of problems do you like solving?”</span></div> : null}
        {messages.map((message, index) => (
          <div className={`${styles.messageRow} ${message.role === 'user' ? styles.userRow : styles.assistantRow}`} key={`${message.role}-${index}`}>
            <div className={`${styles.messageBubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
              <span className={styles.messageLabel}>{message.role === 'user' ? 'You' : 'Matthew’s assistant'}</span>
              <div className={styles.messageContent}><FormattedMessage content={message.content} citations={message.role === 'assistant' && index === messages.length - 1 ? citations : []} citationPrefix={citationPrefix} /></div>
            </div>
          </div>
        ))}
        {busy ? <div className={`${styles.messageRow} ${styles.assistantRow}`}><div className={`${styles.messageBubble} ${styles.assistantBubble} ${styles.loadingBubble}`}><span className={styles.messageLabel}>Matthew’s assistant</span><span className={styles.loadingDots} aria-label="Assistant is thinking"><i /><i /><i /></span></div></div> : null}
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <label className="sr-only" htmlFor="portfolio-ai-question">Message the portfolio assistant</label>
        <textarea id="portfolio-ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={handleComposerKeyDown} maxLength={2000} rows={1} placeholder="Ask about Matthew’s work…" aria-describedby="portfolio-ai-hint" disabled={busy} />
        <button className={styles.sendButton} type="submit" disabled={busy || !question.trim()} aria-label={busy ? 'Assistant is thinking' : 'Send message'}><span aria-hidden="true">↗</span></button>
        <span id="portfolio-ai-hint" className={styles.composerHint}>Enter to send · Shift + Enter for a new line</span>
      </form>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {citations.length ? <div className={styles.citations}><span>Based on</span>{citations.map((citation, index) => citation.sourceUrl ? <a id={`${citationPrefix}-${index + 1}`} data-source-marker="true" key={citation.id} href={citation.sourceUrl} target="_blank" rel="noreferrer">{citation.title}</a> : <span id={`${citationPrefix}-${index + 1}`} data-source-marker="true" tabIndex={-1} key={citation.id}>{citation.title}</span>)}</div> : null}
    </section>
  );
}

export function AskAboutProjectChat({ projectSlug, projectTitle }: { projectSlug: string; projectTitle: string }) {
  return <PortfolioAiChat projectSlug={projectSlug} projectTitle={projectTitle} />;
}
