import { z } from 'zod';

export const aiMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(8000)
}).strict();

export const aiChatRequestSchema = z.object({
  messages: z.array(aiMessageSchema).min(1).max(20),
  projectSlug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,119}$/).optional()
}).strict();

export type AiMessage = z.infer<typeof aiMessageSchema>;

export type AiEvidence = {
  id: string;
  title: string;
  sourceType: 'project' | 'page' | 'document' | 'overview' | 'experience';
  excerpt: string;
  sourceUrl?: string;
  projectSlug?: string;
  vectorStoreId?: string;
};

export type AiRetrieval = {
  evidence: AiEvidence[];
  vectorStoreIds: string[];
};

export type AiCitation = Pick<AiEvidence, 'id' | 'title' | 'sourceType' | 'sourceUrl'>;

export type AiChatResult = {
  answer: string;
  citations: AiCitation[];
  requestId: string;
};
