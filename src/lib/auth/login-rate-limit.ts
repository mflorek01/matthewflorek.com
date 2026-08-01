import { prisma } from '@/lib/db';
import { hashOpaqueToken } from './crypto';

export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_MAX_ATTEMPTS = 8;

function normalizedIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

export function normalizedLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export function loginRateLimitKey(request: Request, email: string) {
  return hashOpaqueToken(`portfolio-login:${normalizedIp(request)}:${normalizedLoginEmail(email)}`).slice(0, 64);
}

export async function recordLoginAttempt(request: Request, email: string, now = new Date()) {
  const bucketStart = new Date(Math.floor(now.getTime() / (LOGIN_WINDOW_SECONDS * 1000)) * LOGIN_WINDOW_SECONDS * 1000);
  const subjectHash = loginRateLimitKey(request, email);
  const record = await prisma.aiRateLimitRecord.upsert({
    where: { subjectHash_bucketStart: { subjectHash, bucketStart } },
    update: { requestCount: { increment: 1 } },
    create: { subjectHash, bucketStart, requestCount: 1 }
  });
  const retryAfter = Math.max(1, Math.ceil((bucketStart.getTime() + LOGIN_WINDOW_SECONDS * 1000 - now.getTime()) / 1000));
  const backoffSeconds = record.requestCount >= 3 ? Math.min(30, 2 ** Math.min(record.requestCount - 3, 5)) : 0;
  return { count: record.requestCount, limited: record.requestCount > LOGIN_MAX_ATTEMPTS, retryAfter, backoffSeconds, subjectHash };
}

export async function clearLoginAttempts(subjectHash: string) {
  await prisma.aiRateLimitRecord.deleteMany({ where: { subjectHash } });
}
