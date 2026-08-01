import { afterEach, describe, expect, it, vi } from 'vitest';

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires DATABASE_URL in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', undefined);
    const { loadEnv } = await import('../src/lib/env');
    expect(() => loadEnv()).toThrowError(/DATABASE_URL is required in production/);
  });

  it('allows development without database url', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', undefined);
    const { loadEnv } = await import('../src/lib/env');
    expect(loadEnv().NODE_ENV).toBe('development');
  });

  it('does not treat the string false as true', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_AI_FEATURES', 'false');
    const { loadEnv } = await import('../src/lib/env');
    expect(loadEnv().ENABLE_AI_FEATURES).toBe(false);
  });

  it('requires feature credentials only when enabled', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_AI_FEATURES', 'true');
    vi.stubEnv('OPENAI_API_KEY', '');
    const { loadEnv } = await import('../src/lib/env');
    expect(() => loadEnv()).toThrowError(/OPENAI_API_KEY is required/);
  });

  it('reads the complete server and public integration configuration', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_SESSION_SECRET', 'a'.repeat(32));
    vi.stubEnv('OPENAI_MODEL', 'gpt-test');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_WEBSITE_ID', 'portfolio-site');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_SCRIPT_URL', 'https://analytics.example.com/script.js');
    vi.stubEnv('NEXT_PUBLIC_UMAMI_DOMAINS', 'matthewflorek.com');
    const { loadEnv } = await import('../src/lib/env');
    expect(loadEnv()).toMatchObject({
      AUTH_SESSION_SECRET: 'a'.repeat(32),
      OPENAI_MODEL: 'gpt-test',
      NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'portfolio-site',
      NEXT_PUBLIC_UMAMI_SCRIPT_URL: 'https://analytics.example.com/script.js',
      NEXT_PUBLIC_UMAMI_DOMAINS: 'matthewflorek.com'
    });
  });

  it('requires public Umami settings when analytics are enabled', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ENABLE_UMAMI', 'true');
    const { loadEnv } = await import('../src/lib/env');
    expect(() => loadEnv()).toThrowError(/NEXT_PUBLIC_UMAMI_WEBSITE_ID is required/);
  });
});
