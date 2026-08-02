'use client';

import { useState, type ReactNode } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';
import type { AiCitation, AiMessage } from '@/lib/ai/types';
import styles from './PortfolioAiChat.module.css';

type Props = { projectSlug?: string; projectTitle?: string };

function formatInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
    : <span key={`${part}-${index}`}>{part}</span>);
}

function FormattedMessage({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(<p key={`paragraph-${blocks.length}`}>{formatInline(paragraph.join(' '))}</p>);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push(<ul key={`list-${blocks.length}`}>{list.map((item, index) => <li key={`${item}-${index}`}>{formatInline(item)}</li>)}</ul>);
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
    <section className={styles.chat} aria-labelledby="ai-chat-title">
      <div className={styles.chatTopline}>
        <div className={styles.chatIdentity}>
          <span className={styles.chatOrb} aria-hidden="true" />
          <h2 id="ai-chat-title">{projectTitle ? `Ask about ${projectTitle}` : 'Ask about Matthew’s work'}</h2>
        </div>
        {messages.length ? <button className={styles.newConversation} type="button" onClick={startNewConversation} disabled={busy}>New conversation</button> : null}
      </div>

      <div className={styles.transcript} aria-live="polite" aria-busy={busy}>
        {!messages.length && !busy ? <div className={styles.emptyState}><p>Ask me about Matthew’s work, projects, or experience.</p><span>Try “What kind of problems do you like solving?”</span></div> : null}
        {messages.map((message, index) => (
          <div className={`${styles.messageRow} ${message.role === 'user' ? styles.userRow : styles.assistantRow}`} key={`${message.role}-${index}`}>
            <div className={`${styles.messageBubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
              <span className={styles.messageLabel}>{message.role === 'user' ? 'You' : 'Matthew’s assistant'}</span>
              <div className={styles.messageContent}><FormattedMessage content={message.content} /></div>
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
      {citations.length ? <div className={styles.citations}><span>Based on</span>{citations.map((citation) => citation.sourceUrl ? <a key={citation.id} href={citation.sourceUrl}>{citation.title}</a> : <span key={citation.id}>{citation.title}</span>)}</div> : null}
    </section>
  );
}

export function AskAboutProjectChat({ projectSlug, projectTitle }: { projectSlug: string; projectTitle: string }) {
  return <PortfolioAiChat projectSlug={projectSlug} projectTitle={projectTitle} />;
}
