import { z } from 'zod';
import { getRuntimeAiCredentials } from './settings';

const optionalPositiveInt = (fallback: number, maximum: number) => z.preprocess(
  (value) => value === undefined || value === '' ? fallback : Number(value),
  z.number().int().positive().max(maximum)
);

const optionalPositiveNumber = (fallback: number, maximum: number) => z.preprocess(
  (value) => value === undefined || value === '' ? fallback : Number(value),
  z.number().positive().max(maximum)
);

const aiConfigSchema = z.object({
  enabledFlag: z.boolean(),
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  publicVectorStoreId: z.string().trim().min(1).optional(),
  publicVectorStoreConfirmed: z.boolean(),
  maxBodyBytes: optionalPositiveInt(40000, 250000),
  maxMessages: optionalPositiveInt(8, 20),
  maxMessageChars: optionalPositiveInt(2000, 8000),
  maxPromptChars: optionalPositiveInt(10000, 30000),
  maxOutputTokens: optionalPositiveInt(700, 2000),
  maxConcurrent: optionalPositiveInt(2, 10),
  rateLimitRequests: optionalPositiveInt(8, 100),
  rateLimitWindowSeconds: optionalPositiveInt(3600, 86400),
  dailyCallLimit: optionalPositiveInt(30, 10000),
  dailyDollarLimit: optionalPositiveNumber(1.5, 10000),
  inputCostPerMillion: optionalPositiveNumber(5, 10000),
  outputCostPerMillion: optionalPositiveNumber(30, 10000),
  trustedProxy: z.boolean(),
  rateLimitSalt: z.string().trim().min(16).optional(),
  adminToken: z.string().trim().min(20).optional(),
  knowledgeRoot: z.string().trim().min(1)
});

export type AiConfig = z.infer<typeof aiConfigSchema> & {
  enabled: boolean;
  disabledReason?: 'disabled' | 'missing_api_key' | 'missing_model';
};

function parseBoolean(value: string | undefined) {
  return value === 'true' || value === '1';
}

export function getAiConfig(): AiConfig {
  const parsed = aiConfigSchema.parse({
    enabledFlag: parseBoolean(process.env.ENABLE_AI_FEATURES),
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    publicVectorStoreId: process.env.OPENAI_AI_PUBLIC_VECTOR_STORE_ID,
    publicVectorStoreConfirmed: parseBoolean(process.env.OPENAI_AI_PUBLIC_VECTOR_STORE_PUBLIC_ONLY),
    maxBodyBytes: process.env.AI_MAX_BODY_BYTES,
    maxMessages: process.env.AI_MAX_MESSAGES,
    maxMessageChars: process.env.AI_MAX_MESSAGE_CHARS,
    maxPromptChars: process.env.AI_MAX_PROMPT_CHARS,
    maxOutputTokens: process.env.AI_MAX_OUTPUT_TOKENS,
    maxConcurrent: process.env.AI_MAX_CONCURRENT,
    rateLimitRequests: process.env.AI_RATE_LIMIT_REQUESTS,
    rateLimitWindowSeconds: process.env.AI_RATE_LIMIT_WINDOW_SECONDS,
    dailyCallLimit: process.env.AI_DAILY_CALL_LIMIT,
    dailyDollarLimit: process.env.AI_DAILY_DOLLAR_LIMIT,
    inputCostPerMillion: process.env.AI_INPUT_COST_PER_MILLION_USD,
    outputCostPerMillion: process.env.AI_OUTPUT_COST_PER_MILLION_USD,
    trustedProxy: parseBoolean(process.env.AI_TRUSTED_PROXY),
    rateLimitSalt: process.env.AI_RATE_LIMIT_SALT ?? process.env.AUTH_SESSION_SECRET,
    adminToken: process.env.AI_ADMIN_TOKEN,
    knowledgeRoot: process.env.AI_KNOWLEDGE_ROOT ?? './content/ai-knowledge'
  });

  const disabledReason = !parsed.enabledFlag
    ? 'disabled'
    : !parsed.apiKey
      ? 'missing_api_key'
      : !parsed.model
        ? 'missing_model'
        : undefined;

  return { ...parsed, enabled: !disabledReason, disabledReason };
}

export async function getRuntimeAiConfig(): Promise<AiConfig> {
  const config = getAiConfig();
  const credentials = await getRuntimeAiCredentials();
  const merged = { ...config, apiKey: credentials.apiKey, model: credentials.model, enabledFlag: credentials.enabledFlag };
  const disabledReason = !merged.enabledFlag ? 'disabled' : !merged.apiKey ? 'missing_api_key' : !merged.model ? 'missing_model' : undefined;
  return { ...merged, enabled: !disabledReason, disabledReason };
}

export function assertAiEnabled(config = getAiConfig()): asserts config is AiConfig & { enabled: true; apiKey: string; model: string } {
  if (!config.enabled || !config.apiKey || !config.model) {
    throw new Error('AI assistant is disabled');
  }
}
