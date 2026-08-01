import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiConfig } from '@/lib/ai/config';

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe('AI configuration', () => {
  it('fails closed without a key or model', () => {
    vi.stubEnv('ENABLE_AI_FEATURES', 'true');
    vi.stubEnv('OPENAI_API_KEY', undefined);
    vi.stubEnv('OPENAI_MODEL', undefined);
    expect(getAiConfig().enabled).toBe(false);
    expect(getAiConfig().disabledReason).toBe('missing_api_key');

    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    expect(getAiConfig().disabledReason).toBe('missing_model');
  });

  it('requires an explicitly confirmed dedicated public vector store', () => {
    vi.stubEnv('ENABLE_AI_FEATURES', 'true');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-5.6-sol');
    vi.stubEnv('OPENAI_AI_PUBLIC_VECTOR_STORE_ID', 'vs-public');
    vi.stubEnv('OPENAI_AI_PUBLIC_VECTOR_STORE_PUBLIC_ONLY', 'true');
    const config = getAiConfig();
    expect(config.enabled).toBe(true);
    expect(config.model).toBe('gpt-5.6-sol');
    expect(config.publicVectorStoreId).toBe('vs-public');
    expect(config.publicVectorStoreConfirmed).toBe(true);
    expect(config.maxBodyBytes).toBe(40000);
  });
});
