import { z } from 'zod';

export const visualBlockTypeSchema = z.enum([
  'hero',
  'heading',
  'text',
  'button',
  'image',
  'spacer',
  'divider',
  'projects',
  'chat',
  'orbit',
  'skills',
  'profile-links'
]);

const safeColor = z.string().trim().regex(/^(transparent|#[0-9a-fA-F]{3,8})$/).max(16);

export const visualBlockStyleSchema = z.object({
  desktopSpan: z.number().int().min(1).max(12).default(12),
  tabletSpan: z.number().int().min(1).max(12).default(12),
  mobileSpan: z.number().int().min(1).max(12).default(12),
  align: z.enum(['left', 'center', 'right']).default('left'),
  paddingTop: z.number().int().min(0).max(200).default(16),
  paddingBottom: z.number().int().min(0).max(200).default(16),
  paddingInline: z.number().int().min(0).max(120).default(0),
  background: safeColor.default('transparent'),
  textColor: safeColor.default('#10213f'),
  borderRadius: z.number().int().min(0).max(60).default(0),
  fontSize: z.enum(['small', 'body', 'large', 'title', 'display']).default('body')
});

export const visualBlockSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: visualBlockTypeSchema,
  content: z.object({
    text: z.string().max(20000).optional(),
    headline: z.string().max(1000).optional(),
    body: z.string().max(5000).optional(),
    primaryLabel: z.string().max(200).optional(),
    primaryHref: z.string().max(2000).optional(),
    secondaryLabel: z.string().max(200).optional(),
    secondaryHref: z.string().max(2000).optional(),
    level: z.enum(['h1', 'h2', 'h3']).optional(),
    label: z.string().max(200).optional(),
    href: z.string().max(2000).optional(),
    variant: z.enum(['primary', 'secondary', 'text']).optional(),
    src: z.string().max(2000).optional(),
    alt: z.string().max(500).optional(),
    category: z.enum(['WORK', 'AI']).optional(),
    height: z.number().int().min(8).max(400).optional()
  }).strict(),
  style: visualBlockStyleSchema
});

export const visualPageDocumentSchema = z.object({
  version: z.literal(1),
  blocks: z.array(visualBlockSchema).max(100)
});

export type VisualBlock = z.infer<typeof visualBlockSchema>;
export type VisualPageDocument = z.infer<typeof visualPageDocumentSchema>;

export function parseVisualPageDocument(value: unknown) {
  const parsed = visualPageDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
