import crypto from 'node:crypto';
import { consumeMetamorphysisAdminRateLimit, MetamorphysisAdminRateLimitError } from './security';

const MAX_ADMIN_TOKEN_LENGTH = 512;

function suppliedAdminToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
    return match?.[1] ?? '';
  }
  return request.headers.get('x-admin-token')?.trim() ?? '';
}

function equalToken(supplied: string, configured: string): boolean {
  const suppliedHash = crypto.createHash('sha256').update(supplied).digest();
  const configuredHash = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(suppliedHash, configuredHash);
}

export { MetamorphysisAdminRateLimitError };

export function assertMetamorphysisAdmin(request: Request) {
  const configured = process.env.METAMORPHYSIS_ADMIN_TOKEN;
  const supplied = suppliedAdminToken(request);
  consumeMetamorphysisAdminRateLimit(request, supplied);
  if (supplied.length > MAX_ADMIN_TOKEN_LENGTH) throw new Error('Metamorphysis admin authentication failed');
  if (process.env.NODE_ENV === 'production' && (!configured || !supplied || !equalToken(supplied, configured))) throw new Error('Metamorphysis admin authentication required');
  if (configured && !equalToken(supplied, configured)) throw new Error('Metamorphysis admin authentication failed');
}
