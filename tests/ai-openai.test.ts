import { describe, expect, it, vi } from 'vitest';
import { createAiResponse, moderateAiInput } from '@/lib/ai/openai';
import type { AiConfig } from '@/lib/ai/config';

const config = {
  enabled: true,
  enabledFlag: true,
  apiKey: 'test-key',
  model: 'gpt-5.6-sol',
  publicVectorStoreId: 'vs-public',
  publicVectorStoreConfirmed: true,
  maxBodyBytes: 40000,
  maxMessages: 8,
  maxMessageChars: 2000,
  maxPromptChars: 10000,
  maxOutputTokens: 700,
  maxConcurrent: 2,
  rateLimitRequests: 8,
  rateLimitWindowSeconds: 3600,
  dailyCallLimit: 30,
  dailyDollarLimit: 1.5,
  inputCostPerMillion: 5,
  outputCostPerMillion: 30,
  trustedProxy: true,
  knowledgeRoot: './content/ai-knowledge'
} satisfies AiConfig & { enabled: true; apiKey: string; model: string };

describe('OpenAI Responses boundary', () => {
  it('uses Responses API, file search only for configured public stores, and no other tools', async () => {
    const create = vi.fn().mockResolvedValue({ output_text: 'A supported answer [E1].', usage: { input_tokens: 10, output_tokens: 12 } });
    const client = { responses: { create }, moderations: { create: vi.fn() } };
    await createAiResponse(client, config, [{ role: 'user', content: 'Tell me about the project.' }], [{ id: 'project:public', title: 'Public project', sourceType: 'project', excerpt: 'Approved evidence.' }], ['vs-public'], 'public');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-5.6-sol', store: false, tools: [{ type: 'file_search', vector_store_ids: ['vs-public'] }] }));
  });

  it('honors moderation flags', async () => {
    const client = { responses: { create: vi.fn() }, moderations: { create: vi.fn().mockResolvedValue({ results: [{ flagged: true }] }) } };
    await expect(moderateAiInput(client, 'unsafe')).resolves.toBe(true);
  });
});
