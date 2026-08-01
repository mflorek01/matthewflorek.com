import { z } from 'zod';

const categoricalValue = z.string().trim().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/);

export const analyticsEventNames = [
  'tab_viewed',
  'project_opened',
  'project_source_clicked',
  'resume_downloaded',
  'github_profile_clicked',
  'contact_cta_clicked',
  'external_link_clicked',
  'ai_chat_started',
  'ai_question_submitted',
  'ai_answer_completed',
  'ai_chat_rate_limited',
  'portfolio_search_used',
  'project_filter_used'
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export const analyticsPropertiesSchema = z.object({
  slug: categoricalValue.optional(),
  tab: categoricalValue.optional(),
  cta: categoricalValue.optional(),
  content_type: categoricalValue.optional(),
  source: categoricalValue.optional(),
  filter: categoricalValue.optional(),
  result: categoricalValue.optional()
}).strict();

export type AnalyticsProperties = z.infer<typeof analyticsPropertiesSchema>;

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  properties?: AnalyticsProperties;
};

export const analyticsEventSchema = z.object({
  name: z.enum(analyticsEventNames),
  properties: analyticsPropertiesSchema.optional()
}).strict();

const normalizationPattern = /[^a-z0-9._:-]+/g;
const analyticsPropertyNames = new Set(Object.keys(analyticsPropertiesSchema.shape));

function normalizeCategoricalValue(value: string) {
  return value.trim().toLowerCase().replace(normalizationPattern, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function sanitizeAnalyticsProperties(properties?: unknown): AnalyticsProperties | undefined {
  if (!properties) return undefined;

  if (typeof properties !== 'object' || Array.isArray(properties)) return undefined;

  const normalizedEntries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(properties)) {
    if (!analyticsPropertyNames.has(key) || typeof value !== 'string' || value.length > 80) return undefined;
    const normalizedValue = normalizeCategoricalValue(value);
    if (!normalizedValue) return undefined;
    normalizedEntries.push([key, normalizedValue]);
  }

  const normalized = Object.fromEntries(normalizedEntries);
  const parsed = analyticsPropertiesSchema.safeParse(normalized);
  return parsed.success ? parsed.data : undefined;
}

export function sanitizeAnalyticsEvent(event: unknown): AnalyticsEvent | undefined {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return undefined;
  const candidate = event as { name?: unknown; properties?: unknown };
  if (typeof candidate.name !== 'string' || !analyticsEventNames.includes(candidate.name as AnalyticsEventName)) return undefined;

  const properties = sanitizeAnalyticsProperties(candidate.properties);
  if (candidate.properties && !properties) return undefined;
  return properties ? { name: candidate.name as AnalyticsEventName, properties } : { name: candidate.name as AnalyticsEventName };
}
