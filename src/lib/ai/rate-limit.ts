import { prisma } from '@/lib/db';

export type RateLimitResult = { allowed: true; retryAfterSeconds: number } | { allowed: false; retryAfterSeconds: number };

export async function consumeAiRateLimit({ subjectHash, limit, windowSeconds, now = new Date() }: { subjectHash: string; limit: number; windowSeconds: number; now?: Date }): Promise<RateLimitResult> {
  const bucketStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucketStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000));
  if (!process.env.DATABASE_URL) return { allowed: true, retryAfterSeconds };
  try {
    const record = await prisma.aiRateLimitRecord.upsert({
      where: { subjectHash_bucketStart: { subjectHash, bucketStart } },
      create: { subjectHash, bucketStart, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
      select: { requestCount: true }
    });
    return record.requestCount <= limit ? { allowed: true, retryAfterSeconds } : { allowed: false, retryAfterSeconds };
  } catch {
    return { allowed: false, retryAfterSeconds: Math.min(retryAfterSeconds, 60) };
  }
}

let activeRequests = 0;

export function acquireAiConcurrency(maxConcurrent: number) {
  if (activeRequests >= maxConcurrent) return false;
  activeRequests += 1;
  return true;
}

export function releaseAiConcurrency() {
  activeRequests = Math.max(0, activeRequests - 1);
}

export function resetAiConcurrencyForTests() {
  activeRequests = 0;
}
