import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AiKnowledgeStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/cms/audit';

export const MAX_KNOWLEDGE_BYTES = 5 * 1024 * 1024;
const allowedExtensions = new Set(['.txt', '.md', '.markdown', '.csv', '.json']);

function knowledgeRoot() {
  return path.resolve(process.env.AI_KNOWLEDGE_ROOT ?? path.join(process.cwd(), 'content', 'ai-knowledge'));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'knowledge-document';
}

function metadataOf(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function publicKnowledgeDocument(document: { id: string; slug: string; title: string; sourceType: string; contentHash: string | null; status: AiKnowledgeStatus; includeInAi: boolean; metadata: unknown; createdAt: Date; updatedAt: Date }) {
  const metadata = metadataOf(document.metadata);
  return {
    id: document.id,
    slug: document.slug,
    title: document.title,
    sourceType: document.sourceType,
    status: document.status,
    includeInAi: document.includeInAi,
    originalName: typeof metadata.originalName === 'string' ? metadata.originalName : null,
    bytes: typeof metadata.bytes === 'number' ? metadata.bytes : null,
    contentType: typeof metadata.contentType === 'string' ? metadata.contentType : null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    contentHash: document.contentHash
  };
}

export async function listKnowledgeDocuments() {
  const documents = await prisma.aiKnowledgeDocument.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true, slug: true, title: true, sourceType: true, contentHash: true, status: true, includeInAi: true, metadata: true, createdAt: true, updatedAt: true } });
  return documents.map(publicKnowledgeDocument);
}

export async function storeKnowledgeDocument(file: File, title: string | undefined, actorId: string) {
  const originalName = file.name.trim().slice(0, 180) || 'knowledge-document.txt';
  const extension = path.extname(originalName).toLowerCase();
  if (!allowedExtensions.has(extension)) throw new Error('Supported knowledge files are .txt, .md, .markdown, .csv, and .json');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_KNOWLEDGE_BYTES) throw new Error('Knowledge documents must be between 1 byte and 5 MB');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('The knowledge document must be UTF-8 text'); }
  if (!content.trim()) throw new Error('The knowledge document is empty');
  const baseTitle = title?.trim().slice(0, 160) || originalName.replace(/\.[^.]+$/, '');
  const slug = `${slugify(baseTitle)}-${randomBytes(5).toString('hex')}`;
  const filename = `${slug}${extension === '.markdown' ? '.md' : extension}`;
  await mkdir(knowledgeRoot(), { recursive: true });
  await writeFile(path.join(knowledgeRoot(), filename), bytes, { flag: 'wx', mode: 0o640 });
  const document = await prisma.aiKnowledgeDocument.create({ data: {
    slug,
    title: baseTitle,
    sourceType: 'admin-upload',
    storagePath: filename,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    status: AiKnowledgeStatus.DRAFT,
    includeInAi: false,
    metadata: { visibility: 'PRIVATE', publicationStatus: 'DRAFT', originalName, bytes: bytes.byteLength, contentType: file.type || 'text/plain' },
    createdById: actorId
  } });
  await recordAudit({ actorId, action: 'ai.knowledge.uploaded', entityType: 'AiKnowledgeDocument', entityId: document.id, metadata: { title: baseTitle, bytes: bytes.byteLength } });
  return publicKnowledgeDocument(document);
}

export async function updateKnowledgeDocument(id: string, input: { title?: string; status?: AiKnowledgeStatus; includeInAi?: boolean }, actorId: string) {
  const current = await prisma.aiKnowledgeDocument.findUnique({ where: { id }, select: { id: true, title: true, metadata: true } });
  if (!current) throw new Error('Knowledge document not found');
  const status = input.status ?? (input.includeInAi === false ? AiKnowledgeStatus.DRAFT : undefined);
  const includeInAi = input.includeInAi ?? (status === AiKnowledgeStatus.PUBLISHED);
  const metadata = { ...metadataOf(current.metadata), visibility: status === AiKnowledgeStatus.PUBLISHED && includeInAi ? 'PUBLIC' : 'PRIVATE', publicationStatus: status === AiKnowledgeStatus.PUBLISHED && includeInAi ? 'PUBLIC' : 'DRAFT' };
  const document = await prisma.aiKnowledgeDocument.update({ where: { id }, data: { title: input.title?.trim().slice(0, 160) || undefined, status, includeInAi, metadata }, select: { id: true, slug: true, title: true, sourceType: true, contentHash: true, status: true, includeInAi: true, metadata: true, createdAt: true, updatedAt: true } });
  await recordAudit({ actorId, action: 'ai.knowledge.updated', entityType: 'AiKnowledgeDocument', entityId: id, metadata: { status: document.status, includeInAi: document.includeInAi } });
  return publicKnowledgeDocument(document);
}
