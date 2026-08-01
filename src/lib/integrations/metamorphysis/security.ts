import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import net from 'node:net';

const MAX_ADMIN_TOKEN_LENGTH = 512;
const MAX_JSON_REQUEST_BYTES = 1_050_000;
const ADMIN_RATE_LIMIT_DEFAULT = 30;
const ADMIN_RATE_WINDOW_DEFAULT_SECONDS = 60;
const MAX_RATE_BUCKETS = 2048;

type ResolvedAddress = { address: string; family: 4 | 6 };

export const MAX_ADMIN_JSON_BYTES = MAX_JSON_REQUEST_BYTES;
export const MAX_SMALL_ADMIN_JSON_BYTES = 32_768;

function ipv4ToInteger(address: string): number {
  return address.split('.').reduce((result, octet) => (result * 256) + Number(octet), 0) >>> 0;
}

function isInIpv4Range(address: string, base: string, maskBits: number): boolean {
  const value = ipv4ToInteger(address);
  const network = ipv4ToInteger(base);
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (value & mask) === (network & mask);
}

/** Return true unless the address is a globally routable unicast address. */
export function isNonGlobalAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.+$/, '');
  if (net.isIPv4(normalized)) {
    return [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
    ].some(([base, bits]) => isInIpv4Range(normalized, base as string, bits as number));
  }
  if (!net.isIPv6(normalized)) return true;
  const hextets = expandIpv6(normalized);
  if (!hextets) return true;
  const mapped = hextets.slice(0, 5).every((value) => value === 0) && hextets[5] === 0xffff;
  if (mapped) {
    const mappedAddress = `${(hextets[6] >> 8) & 255}.${hextets[6] & 255}.${(hextets[7] >> 8) & 255}.${hextets[7] & 255}`;
    return isNonGlobalAddress(mappedAddress);
  }
  const first = hextets[0];
  return hextets.every((value) => value === 0) || (hextets[7] === 1 && hextets.slice(0, 7).every((value) => value === 0)) ||
    (first & 0xfe00) === 0xfc00 || // unique local (fc00::/7)
    (first & 0xffc0) === 0xfe80 || // link local (fe80::/10)
    (first & 0xff00) === 0xff00 || // multicast (ff00::/8)
    (hextets[0] === 0x2001 && hextets[1] === 0x0db8) || // documentation
    (hextets[0] === 0x2001 && hextets[1] === 0) || // Teredo
    hextets[0] === 0x2002 || // 6to4; do not allow tunnel indirection
    (hextets[0] === 0x2001 && (hextets[1] === 0x0002 || hextets[1] === 0x0010 || hextets[1] === 0x0020));
}

function expandIpv6(address: string): number[] | null {
  const [left, right] = address.split('::');
  if (address.split('::').length > 2) return null;
  const parse = (part: string): number[] => part ? part.split(':').flatMap((piece): number[] => {
    if (piece.includes('.')) {
      if (!net.isIPv4(piece)) return [];
      const number = ipv4ToInteger(piece);
      return [(number >>> 16) & 0xffff, number & 0xffff];
    }
    return /^[0-9a-f]{1,4}$/.test(piece) ? [Number.parseInt(piece, 16)] : [];
  }) : [];
  const leftParts = parse(left);
  const rightParts = parse(right ?? '');
  if (leftParts.length + rightParts.length > 8 || (right === undefined && leftParts.length !== 8)) return null;
  const zeroes = Array<number>(8 - leftParts.length - rightParts.length).fill(0);
  return right === undefined ? leftParts : [...leftParts, ...zeroes, ...rightParts];
}

export type SafeMetamorphysisTarget = { url: URL; address: ResolvedAddress };

function configuredAllowedAddresses(): string[] {
  return (process.env.METAMORPHYSIS_SYNC_ALLOWED_IPS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
}

function assertAllowedAddressFormat(addresses: string[]) {
  if (addresses.some((address) => !net.isIP(address) || isNonGlobalAddress(address))) {
    throw new Error('Metamorphysis sync allowlist contains a non-global or invalid address');
  }
}

export async function resolveSafeMetamorphysisTarget(rawUrl: string, configuredUrl = process.env.METAMORPHYSIS_SYNC_URL): Promise<SafeMetamorphysisTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Metamorphysis sync URL is invalid');
  }
  if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('Metamorphysis sync requires HTTPS in production');
  if (url.username || url.password || url.hash) throw new Error('Metamorphysis sync URL may not contain credentials or fragments');
  if (!configuredUrl) throw new Error('Metamorphysis sync URL is not configured');
  const configured = new URL(configuredUrl);
  if (url.origin !== configured.origin || url.pathname !== configured.pathname || url.search !== configured.search) {
    throw new Error('Metamorphysis sync URL is outside the configured read-only endpoint');
  }
  if (url.protocol !== 'https:') throw new Error('Metamorphysis sync endpoint must use HTTPS');
  if (['localhost', 'localhost.localdomain', 'metadata.google.internal'].includes(url.hostname.toLowerCase())) throw new Error('Private sync hosts are not allowed');

  const allowlist = configuredAllowedAddresses();
  assertAllowedAddressFormat(allowlist);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses: ResolvedAddress[] = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }]
    : (await dns.lookup(hostname, { all: true, verbatim: true })).map(({ address, family }) => ({ address, family: family as 4 | 6 }));
  if (!addresses.length || addresses.some(({ address }) => isNonGlobalAddress(address))) throw new Error('Metamorphysis sync target is private or non-global');
  if (process.env.NODE_ENV === 'production' && !allowlist.length) throw new Error('METAMORPHYSIS_SYNC_ALLOWED_IPS is required in production');
  const selected = addresses.find(({ address }) => !allowlist.length || allowlist.includes(address));
  if (!selected) throw new Error('Metamorphysis sync host did not resolve to an allowlisted address');
  return { url, address: selected };
}

export async function assertSafeMetamorphysisUrl(rawUrl: string, configuredUrl = process.env.METAMORPHYSIS_SYNC_URL): Promise<URL> {
  return (await resolveSafeMetamorphysisTarget(rawUrl, configuredUrl)).url;
}

function hashRateLimitPart(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

type RateBucket = { count: number; resetAt: number };
const adminRateBuckets = new Map<string, RateBucket>();

function requestClientIp(request: Request): string {
  if (process.env.METAMORPHYSIS_TRUSTED_PROXY !== 'true') return 'unknown';
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export class MetamorphysisAdminRateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('Metamorphysis admin rate limit exceeded');
    this.name = 'MetamorphysisAdminRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function consumeMetamorphysisAdminRateLimit(request: Request, token: string): void {
  const limit = Number.parseInt(process.env.METAMORPHYSIS_ADMIN_RATE_LIMIT_REQUESTS ?? String(ADMIN_RATE_LIMIT_DEFAULT), 10);
  const windowSeconds = Number.parseInt(process.env.METAMORPHYSIS_ADMIN_RATE_LIMIT_WINDOW_SECONDS ?? String(ADMIN_RATE_WINDOW_DEFAULT_SECONDS), 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 1000 ? limit : ADMIN_RATE_LIMIT_DEFAULT;
  const safeWindow = Number.isFinite(windowSeconds) && windowSeconds > 0 && windowSeconds <= 86_400 ? windowSeconds : ADMIN_RATE_WINDOW_DEFAULT_SECONDS;
  const now = Date.now();
  for (const [key, bucket] of adminRateBuckets) if (bucket.resetAt <= now) adminRateBuckets.delete(key);
  const consume = (key: string) => {
    const current = adminRateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      while (adminRateBuckets.size >= MAX_RATE_BUCKETS) {
        const oldest = adminRateBuckets.keys().next().value;
        if (!oldest) break;
        adminRateBuckets.delete(oldest);
      }
      adminRateBuckets.set(key, { count: 1, resetAt: now + safeWindow * 1000 });
      return;
    }
    if (current.count >= safeLimit) throw new MetamorphysisAdminRateLimitError(Math.max(1, Math.ceil((current.resetAt - now) / 1000)));
    current.count += 1;
  };
  consume(`ip:${hashRateLimitPart(requestClientIp(request))}`);
  consume(`token:${hashRateLimitPart(token.slice(0, MAX_ADMIN_TOKEN_LENGTH))}`);
}

export async function readBoundedJson(request: Request, maxBytes = MAX_JSON_REQUEST_BYTES): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes)) throw new Error('Request exceeds the JSON body limit');
  if (!request.body) throw new Error('Request body is required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Request exceeds the JSON body limit');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
  } catch {
    throw new Error('Request body is not valid JSON');
  }
}

export function redactSyncError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Metamorphysis sync failed';
  return message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/https?:\/\/[^\s]+/gi, '[url redacted]').slice(0, 500);
}
