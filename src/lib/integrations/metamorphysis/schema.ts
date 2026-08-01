import { z } from 'zod';

export const MAX_IMPORT_BYTES = 1_000_000;
export const MAX_IMPORT_RECORDS = 100;
export const FETCH_TIMEOUT_MS = 8_000;

const safeText = (max: number) => z.string().trim().min(1).max(max);
const jsonScalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
const safeHttpUrl = z.string().trim().url().max(2048).refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'https:' || protocol === 'http:';
}, 'Links must use HTTP(S)');

export const metamorphysisProjectSchema = z.object({
  id: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  title: safeText(240),
  summary: safeText(3000),
  category: z.enum(['WORK', 'AI']).default('WORK'),
  tags: z.array(z.string().trim().min(1).max(80)).max(24).default([]),
  links: z.array(z.object({
    label: safeText(100),
    url: safeHttpUrl
  }).strict()).max(12).default([]),
  details: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/), jsonScalar).optional()
}).strict();

export const metamorphysisExportSchema = z.object({
  sourceVersion: safeText(160),
  sourceUpdatedAt: z.string().datetime({ offset: true }).optional(),
  projects: z.array(metamorphysisProjectSchema).min(0).max(100),
  metadata: z.object({
    exportId: z.string().trim().min(1).max(160).optional(),
    generatedBy: z.string().trim().min(1).max(160).optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  for (const project of value.projects) {
    if (ids.has(project.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['projects'], message: `Duplicate project id: ${project.id}` });
    }
    ids.add(project.id);
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_IMPORT_BYTES) {
    ctx.addIssue({ code: z.ZodIssueCode.too_big, path: [], maximum: MAX_IMPORT_BYTES, type: 'string', inclusive: true, message: 'Import exceeds the byte limit' });
  }
});

export const metamorphysisImportRequestSchema = z.object({
  mode: z.enum(['manual', 'remote']),
  json: z.string().max(MAX_IMPORT_BYTES).optional(),
  payload: z.unknown().optional()
}).strict().superRefine((value, ctx) => {
  if (value.mode === 'manual' && value.json === undefined && value.payload === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['json'], message: 'Manual imports require json or payload' });
  }
  if (value.mode === 'remote' && (value.json !== undefined || value.payload !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'Remote imports do not accept a payload' });
  }
});

export const metamorphysisApproveRequestSchema = z.object({
  externalProjectId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  snapshotId: z.string().trim().min(1).max(128).optional()
}).strict();

export const metamorphysisOverridesRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  fields: z.record(z.string().trim().min(1).max(64), z.unknown()).superRefine((value, ctx) => {
    if (Object.keys(value).length > 12) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Too many override fields' });
  })
}).strict();

export type MetamorphysisExport = z.infer<typeof metamorphysisExportSchema>;
export type MetamorphysisProject = z.infer<typeof metamorphysisProjectSchema>;

export function parseMetamorphysisExport(input: unknown): MetamorphysisExport {
  return metamorphysisExportSchema.parse(input);
}

export function parseMetamorphysisJson(text: string): MetamorphysisExport {
  if (Buffer.byteLength(text, 'utf8') > MAX_IMPORT_BYTES) {
    throw new Error('Metamorphysis import exceeds the 1 MB limit');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Metamorphysis import is not valid JSON');
  }
  return parseMetamorphysisExport(parsed);
}
