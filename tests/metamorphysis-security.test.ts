import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertSafeMetamorphysisUrl, redactSyncError } from '../src/lib/integrations/metamorphysis/security';

describe('Metamorphysis sync security', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requires the exact configured endpoint and rejects credentials/fragments', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('METAMORPHYSIS_SYNC_URL', 'https://meta.example.test/api/export');
    const lookup = vi.spyOn((await import('node:dns/promises')).default, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    await expect(assertSafeMetamorphysisUrl('https://meta.example.test/api/other')).rejects.toThrow(/configured/);
    await expect(assertSafeMetamorphysisUrl('https://user:pass@meta.example.test/api/export')).rejects.toThrow(/credentials/);
    await expect(assertSafeMetamorphysisUrl('https://meta.example.test/api/export#write')).rejects.toThrow(/credentials/);
    lookup.mockRestore();
  });

  it('rejects private resolved addresses', async () => {
    vi.stubEnv('METAMORPHYSIS_SYNC_URL', 'https://meta.example.test/api/export');
    vi.spyOn((await import('node:dns/promises')).default, 'lookup').mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(assertSafeMetamorphysisUrl('https://meta.example.test/api/export')).rejects.toThrow(/private or non-global/i);
  });

  it('rejects IPv4-mapped IPv6 private addresses and enforces the production allowlist', async () => {
    vi.stubEnv('METAMORPHYSIS_SYNC_URL', 'https://meta.example.test/api/export');
    const lookup = vi.spyOn((await import('node:dns/promises')).default, 'lookup').mockResolvedValue([{ address: '::ffff:127.0.0.1', family: 6 }] as never);
    await expect(assertSafeMetamorphysisUrl('https://meta.example.test/api/export')).rejects.toThrow(/private or non-global/i);
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('METAMORPHYSIS_SYNC_ALLOWED_IPS', '93.184.216.35');
    await expect(assertSafeMetamorphysisUrl('https://meta.example.test/api/export')).rejects.toThrow(/allowlisted/i);
  });

  it('redacts bearer tokens and URLs from errors', () => {
    expect(redactSyncError(new Error('GET https://secret.example/api failed with Bearer super-secret'))).toBe('GET [url redacted] failed with Bearer [redacted]');
  });
});
