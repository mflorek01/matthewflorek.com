import { envSchema } from './contracts';

export type AppEnv = Readonly<ReturnType<typeof loadEnv>>;

let cachedEnv: AppEnv | null = null;

function readEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    ENABLE_CMS_SYNC: process.env.ENABLE_CMS_SYNC,
    ENABLE_METAMORPHYSIS_SYNC: process.env.ENABLE_METAMORPHYSIS_SYNC,
    ENABLE_AI_FEATURES: process.env.ENABLE_AI_FEATURES,
    ENABLE_UMAMI: process.env.ENABLE_UMAMI,
    ANALYTICS_MODE: process.env.ANALYTICS_MODE,
    NEXT_PUBLIC_ANALYTICS_MODE: process.env.NEXT_PUBLIC_ANALYTICS_MODE,
    PUBLIC_CONTENT_MODE: process.env.PUBLIC_CONTENT_MODE,
    CMS_BASE_URL: process.env.CMS_BASE_URL,
    CMS_API_TOKEN: process.env.CMS_API_TOKEN,
    METAMORPHYSIS_SYNC_URL: process.env.METAMORPHYSIS_SYNC_URL,
    METAMORPHYSIS_SYNC_TOKEN: process.env.METAMORPHYSIS_SYNC_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    UMAMI_WEBSITE_ID: process.env.UMAMI_WEBSITE_ID,
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    UMAMI_SCRIPT_URL: process.env.UMAMI_SCRIPT_URL,
    NEXT_PUBLIC_UMAMI_SCRIPT_URL: process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
    UMAMI_DOMAINS: process.env.UMAMI_DOMAINS,
    NEXT_PUBLIC_UMAMI_DOMAINS: process.env.NEXT_PUBLIC_UMAMI_DOMAINS
  };
}

export function loadEnv() {
  const parsed = envSchema.parse(readEnv());
  return parsed;
}

export function getEnv() {
  cachedEnv ??= loadEnv();
  return cachedEnv;
}
