import { z } from 'zod';

const trimmedNonEmptyString = z.string().trim().min(1);
const optionalString = z.string().trim().optional().or(z.literal(''));
const optionalUrl = z.string().trim().url().optional().or(z.literal(''));
const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === '') return false;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: optionalUrl,
  AUTH_SESSION_SECRET: optionalString,
  ENABLE_CMS_SYNC: booleanFromEnv,
  ENABLE_METAMORPHYSIS_SYNC: booleanFromEnv,
  ENABLE_AI_FEATURES: booleanFromEnv,
  ENABLE_UMAMI: booleanFromEnv,
  ANALYTICS_MODE: z.enum(['off', 'cookieless', 'consent']).optional(),
  NEXT_PUBLIC_ANALYTICS_MODE: z.enum(['off', 'cookieless', 'consent']).optional(),
  PUBLIC_CONTENT_MODE: z.enum(['static', 'database']).default('static'),
  CMS_BASE_URL: optionalUrl,
  CMS_API_TOKEN: optionalString,
  METAMORPHYSIS_SYNC_URL: optionalUrl,
  METAMORPHYSIS_SYNC_TOKEN: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-5-mini'),
  UMAMI_WEBSITE_ID: optionalString,
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: optionalString,
  UMAMI_SCRIPT_URL: optionalUrl,
  NEXT_PUBLIC_UMAMI_SCRIPT_URL: optionalUrl,
  UMAMI_DOMAINS: optionalString,
  NEXT_PUBLIC_UMAMI_DOMAINS: optionalString
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production' && !value.DATABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'DATABASE_URL is required in production',
      path: ['DATABASE_URL']
    });
  }

  if (value.NODE_ENV === 'production' && (!value.AUTH_SESSION_SECRET || value.AUTH_SESSION_SECRET.length < 32)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'AUTH_SESSION_SECRET of at least 32 characters is required in production',
      path: ['AUTH_SESSION_SECRET']
    });
  }

  if (value.ENABLE_CMS_SYNC) {
    if (!value.CMS_BASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CMS_BASE_URL is required when ENABLE_CMS_SYNC=true', path: ['CMS_BASE_URL'] });
    }
    if (!value.CMS_API_TOKEN) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CMS_API_TOKEN is required when ENABLE_CMS_SYNC=true', path: ['CMS_API_TOKEN'] });
    }
  }

  if (value.ENABLE_METAMORPHYSIS_SYNC) {
    if (!value.METAMORPHYSIS_SYNC_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'METAMORPHYSIS_SYNC_URL is required when ENABLE_METAMORPHYSIS_SYNC=true', path: ['METAMORPHYSIS_SYNC_URL'] });
    }
    if (!value.METAMORPHYSIS_SYNC_TOKEN) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'METAMORPHYSIS_SYNC_TOKEN is required when ENABLE_METAMORPHYSIS_SYNC=true', path: ['METAMORPHYSIS_SYNC_TOKEN'] });
    }
  }

  if (value.ENABLE_AI_FEATURES && !value.OPENAI_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'OPENAI_API_KEY is required when ENABLE_AI_FEATURES=true', path: ['OPENAI_API_KEY'] });
  }

  if (value.ENABLE_UMAMI) {
    if (!value.UMAMI_WEBSITE_ID && !value.NEXT_PUBLIC_UMAMI_WEBSITE_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'UMAMI_WEBSITE_ID is required when ENABLE_UMAMI=true',
        path: ['UMAMI_WEBSITE_ID']
      });
    }
    if (!value.UMAMI_SCRIPT_URL && !value.NEXT_PUBLIC_UMAMI_SCRIPT_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'UMAMI_SCRIPT_URL is required when ENABLE_UMAMI=true',
        path: ['UMAMI_SCRIPT_URL']
      });
    }
  }
});

export const healthQuerySchema = z.object({
  db: z.enum(['1', 'true']).optional()
});

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  status: z.enum(['ok', 'degraded', 'error']),
  checks: z.object({
    db: z.enum(['pass', 'fail', 'skip'])
  })
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const nonEmptyStringSchema = trimmedNonEmptyString;
