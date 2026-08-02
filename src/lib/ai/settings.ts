import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';

const SETTINGS_ID = 'default';
const ALGORITHM = 'aes-256-gcm';

function encryptionKey() {
  // ADMIN_SETTINGS_ENCRYPTION_KEY should be a 32-byte hex/base64 value. The
  // session secret fallback is only for deployments that have not yet added
  // the dedicated secret; set the dedicated secret before production use.
  const configured = process.env.ADMIN_SETTINGS_ENCRYPTION_KEY;
  const fallback = configured || process.env.AUTH_SESSION_SECRET;
  if (!fallback) throw new Error('Admin settings encryption is not configured');
  if (/^[0-9a-f]{64}$/i.test(fallback)) return Buffer.from(fallback, 'hex');
  try {
    const decoded = Buffer.from(fallback, 'base64');
    if (decoded.length === 32) return decoded;
  } catch { /* use the derived key below */ }
  return createHash('sha256').update(fallback).digest();
}

export function encryptAiApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptAiApiKey(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(':');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('Invalid encrypted admin setting');
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8');
}

type StoredSettings = { encryptedApiKey: string | null; apiKeyLastFour: string | null; model: string | null; enabled: boolean };

export async function getStoredAiSettings(): Promise<StoredSettings | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await prisma.aiAssistantSettings.findUnique({ where: { id: SETTINGS_ID }, select: { encryptedApiKey: true, apiKeyLastFour: true, model: true, enabled: true } });
  } catch {
    return null;
  }
}

export async function getAiSettingsStatus() {
  const stored = await getStoredAiSettings();
  const envKey = process.env.OPENAI_API_KEY?.trim() || null;
  const hasKey = Boolean(stored?.encryptedApiKey || envKey);
  return {
    configured: hasKey,
    enabled: Boolean(stored ? stored.enabled && hasKey : process.env.ENABLE_AI_FEATURES === 'true' && envKey),
    apiKeyLastFour: stored?.apiKeyLastFour ?? (envKey ? envKey.slice(-4) : null),
    model: stored?.model ?? process.env.OPENAI_MODEL ?? null,
    source: stored ? 'database' : 'environment'
  } as const;
}

export async function getRuntimeAiCredentials() {
  const stored = await getStoredAiSettings();
  if (stored) {
    let apiKey: string | undefined;
    if (stored.encryptedApiKey) {
      try { apiKey = decryptAiApiKey(stored.encryptedApiKey); } catch { apiKey = undefined; }
    }
    return { apiKey: apiKey ?? process.env.OPENAI_API_KEY, model: stored.model ?? process.env.OPENAI_MODEL, enabledFlag: stored.enabled };
  }
  return { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL, enabledFlag: process.env.ENABLE_AI_FEATURES === 'true' };
}

export async function testAiCredential(apiKey: string) {
  // models.list validates the credential without spending inference tokens.
  await new OpenAI({ apiKey }).models.list();
}

export async function auditAiCredentialTest(actorId: string) {
  await prisma.auditLog.create({ data: { actorId, action: 'ai.settings.credential_tested', entityType: 'AiAssistantSettings', entityId: SETTINGS_ID } });
}

export async function saveAiSettings({ apiKey, model, enabled, actorId }: { apiKey?: string; model?: string; enabled?: boolean; actorId: string }) {
  const current = await getStoredAiSettings();
  const encryptedApiKey = apiKey ? encryptAiApiKey(apiKey) : current?.encryptedApiKey ?? null;
  const lastFour = apiKey ? apiKey.slice(-4) : current?.apiKeyLastFour ?? null;
  const record = await prisma.aiAssistantSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, encryptedApiKey, apiKeyLastFour: lastFour, model: model ?? process.env.OPENAI_MODEL ?? null, enabled: enabled ?? false },
    update: { encryptedApiKey, apiKeyLastFour: lastFour, ...(model !== undefined ? { model } : {}), ...(enabled !== undefined ? { enabled } : {}) }
  });
  await prisma.auditLog.create({ data: { actorId, action: apiKey ? 'ai.settings.key_saved' : enabled !== undefined ? `ai.settings.${enabled ? 'enabled' : 'disabled'}` : 'ai.settings.updated', entityType: 'AiAssistantSettings', entityId: SETTINGS_ID, metadata: { configured: Boolean(record.encryptedApiKey), model: record.model, enabled: record.enabled, apiKeyLastFour: record.apiKeyLastFour } } });
  return record;
}

export async function removeAiSettings(actorId: string) {
  await prisma.aiAssistantSettings.deleteMany({ where: { id: SETTINGS_ID } });
  await prisma.auditLog.create({ data: { actorId, action: 'ai.settings.removed', entityType: 'AiAssistantSettings', entityId: SETTINGS_ID } });
}
