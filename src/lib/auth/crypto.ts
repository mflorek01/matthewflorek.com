import { createHash, randomBytes } from 'node:crypto';

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function hashIp(value: string | null | undefined) {
  return value ? hashOpaqueToken(value).slice(0, 32) : null;
}

