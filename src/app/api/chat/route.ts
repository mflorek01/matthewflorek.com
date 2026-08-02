import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { aiChatRequestSchema } from '@/lib/ai/types';
import { getRuntimeAiConfig, assertAiEnabled } from '@/lib/ai/config';
import { containsAbuseSignal, looksLikePromptInjection } from '@/lib/ai/abuse';
import { retrievePublicEvidence } from '@/lib/ai/boundary';
import { AiBodyTooLargeError, AiInvalidJsonError, readBoundedJson } from '@/lib/ai/body';
import { createAiOpenAIClient, createAiResponse, moderateAiInput } from '@/lib/ai/openai';
import { acquireAiConcurrency, consumeAiRateLimit, releaseAiConcurrency } from '@/lib/ai/rate-limit';
import { aiFailureLog, createRequestId, hashRequestSubject } from '@/lib/ai/privacy';
import { recordAiSettlementFailure, reserveAiSpend, settleAiSpend } from '@/lib/ai/spend';
import type { AiCitation } from '@/lib/ai/types';
import type { SpendReservation } from '@/lib/ai/spend';

export const runtime = 'nodejs';

function jsonError(message: string, status: number, retryAfterSeconds?: number) {
  const response = NextResponse.json({ error: { code: status === 429 ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', message } }, { status });
  if (retryAfterSeconds) response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}

function citationsForEvidence(evidence: Awaited<ReturnType<typeof retrievePublicEvidence>>['evidence']): AiCitation[] {
  return evidence.map(({ id, title, sourceType, sourceUrl }) => ({ id, title, sourceType, sourceUrl }));
}

function addCitations(answer: string, citations: AiCitation[]) {
  if (!citations.length || /\[E\d+\]/.test(answer)) return answer;
  return `${answer.trim()}\n\nEvidence: ${citations.map((_, index) => `[E${index + 1}]`).join(' ')}`;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  let reservation: SpendReservation | undefined;
  let settlementFailureRecorded = false;
  let concurrencyAcquired = false;
  try {
    const config = await getRuntimeAiConfig();
    assertAiEnabled(config);
    let body: unknown;
    try {
      body = await readBoundedJson(request, config.maxBodyBytes);
    } catch (error) {
      if (error instanceof AiBodyTooLargeError) return jsonError('That request body is too large.', 413);
      if (error instanceof AiInvalidJsonError) return jsonError('Please send a valid JSON conversation.', 400);
      throw error;
    }
    const parsed = aiChatRequestSchema.safeParse(body);
    if (!parsed.success) return jsonError('Please send a shorter, valid conversation.', 400);
    const messages = parsed.data.messages.slice(-config.maxMessages).map((message) => ({ ...message, content: message.content.trim() }));
    if (messages.some((message) => message.content.length > config.maxMessageChars)) return jsonError('That message is too long.', 400);
    const promptChars = messages.reduce((total, message) => total + message.content.length, 0);
    if (promptChars > config.maxPromptChars) return jsonError('That conversation is too long. Please start a new one.', 400);
    const latestMessage = messages.at(-1)?.content ?? '';
    if (looksLikePromptInjection(latestMessage) || containsAbuseSignal(latestMessage)) return jsonError('I can answer questions about the approved portfolio material, but not requests for hidden instructions or private data.', 400);

    const subjectHash = hashRequestSubject(request, config.rateLimitSalt ?? 'portfolio-ai-local-salt', config.trustedProxy);
    const rate = await consumeAiRateLimit({ subjectHash, limit: config.rateLimitRequests, windowSeconds: config.rateLimitWindowSeconds });
    if (!rate.allowed) return jsonError('The public assistant is temporarily rate-limited. Please try again later.', 429, rate.retryAfterSeconds);
    if (!acquireAiConcurrency(config.maxConcurrent)) return jsonError('The public assistant is busy. Please try again shortly.', 429, 15);
    concurrencyAcquired = true;

    const retrieval = await retrievePublicEvidence(latestMessage, parsed.data.projectSlug);
    const citations = citationsForEvidence(retrieval.evidence);
    if (!retrieval.evidence.length) {
      return NextResponse.json({ answer: 'I do not have enough approved public portfolio material to answer that yet.', citations: [], requestId });
    }

    const reservationResult = await reserveAiSpend({ config, requestId });
    if (!reservationResult.ok) {
      return jsonError(reservationResult.reason === 'daily_calls' || reservationResult.reason === 'daily_spend' ? 'The public assistant has reached its daily usage limit. Please try again tomorrow.' : 'The public assistant is temporarily unavailable.', reservationResult.reason === 'daily_calls' || reservationResult.reason === 'daily_spend' ? 429 : 503, 3600);
    }
    reservation = reservationResult.reservation;
    const client = createAiOpenAIClient(config);
    if (await moderateAiInput(client, latestMessage)) {
      const settlement = await settleAiSpend({ reservation, requestId, model: config.model, inputTokens: 0, outputTokens: 0, config, status: 'FAILED' });
      settlementFailureRecorded = !settlement.ok;
      if (!settlement.ok) return jsonError('The public assistant is temporarily unavailable. Please try again later.', 503, 30);
      reservation = undefined;
      return jsonError('I can help with the portfolio, but I cannot process that request.', 400);
    }
    const response = await createAiResponse(client, config, messages, retrieval.evidence, retrieval.vectorStoreIds, parsed.data.projectSlug, subjectHash);
    const answer = addCitations(response.output_text?.trim() || 'I do not have enough approved public evidence to answer that confidently.', citations);
    const settlement = await settleAiSpend({ reservation, requestId, model: config.model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, config });
    settlementFailureRecorded = !settlement.ok;
    if (!settlement.ok) return jsonError('The public assistant is temporarily unavailable. Please try again later.', 503, 30);
    reservation = undefined;
    return NextResponse.json({ answer, citations, requestId });
  } catch (error) {
    if (reservation && !settlementFailureRecorded) {
      settlementFailureRecorded = await recordAiSettlementFailure({ reservation, requestId, model: (await getRuntimeAiConfig()).model ?? 'unknown' });
    }
    console.warn('[ai] request failed', aiFailureLog(error, requestId));
    return jsonError('The public assistant is temporarily unavailable. Please try again later.', 503, 30);
  } finally {
    if (concurrencyAcquired) releaseAiConcurrency();
  }
}
