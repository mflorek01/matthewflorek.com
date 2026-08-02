import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptAiApiKey, encryptAiApiKey } from '@/lib/ai/settings';

beforeEach(() => {
  vi.stubEnv('ADMIN_SETTINGS_ENCRYPTION_KEY', '0123456789abcdef0123456789abcdef');
  vi.stubEnv('AUTH_SESSION_SECRET', 'session-secret-that-is-long-enough');
});

describe('encrypted AI settings', () => {
  it('round-trips API keys without storing plaintext', () => {
    const key = 'sk-test-secret-value-123456';
    const encrypted = encryptAiApiKey(key);
    expect(encrypted).not.toContain(key);
    expect(decryptAiApiKey(encrypted)).toBe(key);
  });
});
