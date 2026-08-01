import { createHash, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

function firstForwardedIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function hashRequestSubject(request: NextRequest, salt: string, trustedProxy: boolean) {
  const ip = trustedProxy ? firstForwardedIp(request) : 'untrusted-proxy';
  const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? 'unknown';
  return createHash('sha256').update(`${salt}:${ip}:${userAgent}`).digest('hex');
}

export function createRequestId() {
  return randomUUID();
}

function safeIdentifier(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value) ? value : undefined;
}

export function getProviderRequestId(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as Record<string, unknown>;
  return safeIdentifier(record.request_id) ?? safeIdentifier(record.requestId);
}

export function getProviderStatus(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as Record<string, unknown>).status;
  return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
}

export function getAiErrorClass(error: unknown) {
  if (error instanceof Error && error.constructor.name) return safeIdentifier(error.constructor.name) ?? 'Error';
  return typeof error;
}

export function aiFailureLog(error: unknown, requestId: string) {
  const providerRequestId = getProviderRequestId(error);
  return {
    requestId,
    errorClass: getAiErrorClass(error),
    status: getProviderStatus(error) ?? null,
    ...(providerRequestId ? { providerRequestId } : {})
  };
}
