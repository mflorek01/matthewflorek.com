import { z } from 'zod';

export const visibilitySchema = z.enum(['PUBLIC', 'PRIVATE', 'UNLISTED']);
export const publicationStatusSchema = z.enum(['PUBLIC', 'DRAFT', 'NEEDS_REVIEW', 'ARCHIVED']);
export const revisionStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(), z.number(), z.boolean(), z.null(),
  z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)
]));

export const cmsBlockSchema = z.object({
  id: z.string().cuid().optional(),
  blockKey: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(10000),
  visibility: visibilitySchema,
  includeInAi: z.boolean(),
  data: z.record(z.string(), jsonValueSchema)
});

export const pageDraftSchema = z.object({
  title: z.string().trim().min(1).max(180),
  blocks: z.array(cmsBlockSchema).max(100)
});

export const projectLinkSchema = z.object({
  id: z.string().cuid().optional(),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(2000),
  sortOrder: z.number().int().min(0).max(10000)
});

export const projectDraftSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  categoryId: z.string().cuid(),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().min(1).max(1000),
  details: jsonValueSchema.optional(),
  publicationStatus: publicationStatusSchema,
  visibility: visibilitySchema,
  sortOrder: z.number().int().min(0).max(10000),
  includeInAi: z.boolean(),
  source: z.string().trim().max(4000).nullable().optional(),
  reviewNotes: z.string().trim().max(4000).nullable().optional(),
  links: z.array(projectLinkSchema).max(50)
});

export type PageDraft = z.infer<typeof pageDraftSchema>;
export type ProjectDraft = z.infer<typeof projectDraftSchema>;

