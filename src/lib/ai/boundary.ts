import { promises as fs } from 'node:fs';
import path from 'node:path';
import { aiOverview, aiProjects } from '@/lib/content/portfolio';
import careerContext from '../../../content/ai-career-context.json';
import { prisma } from '@/lib/db';
import { getAiConfig } from './config';
import type { AiEvidence, AiRetrieval } from './types';

const MAX_EXCERPT_CHARS = 12000;

function cleanText(value: unknown, maximum = MAX_EXCERPT_CHARS) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function publicLinkUrl(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (record.visibility === 'PRIVATE' || record.publicationStatus === 'DRAFT' || record.publicationStatus === 'NEEDS_REVIEW') return undefined;
  return typeof record.url === 'string' && /^https:\/\//.test(record.url) ? record.url : undefined;
}

function staticEvidence(): AiEvidence[] {
  const result: AiEvidence[] = [];
  if (aiOverview.includeInAi) {
    result.push({
      id: 'overview',
      title: aiOverview.name,
      sourceType: 'overview',
      excerpt: [aiOverview.headline, aiOverview.shortBio, aiOverview.longBio, `Skills: ${aiOverview.skills.join(', ')}`, `Education: ${aiOverview.education.map((item) => `${item.credential}, ${item.institution} (${item.year})`).join('; ')}`].map(cleanText).filter(Boolean).join(' ')
    });
  }
  for (const role of careerContext.roles) {
    result.push({ id: role.id, title: role.title, sourceType: 'experience', excerpt: cleanText(role.excerpt) });
  }
  for (const project of aiProjects) {
    const sourceUrl = project.links.map(publicLinkUrl).find(Boolean);
    const detailText = [project.details.context, project.details.contribution, project.details.outcome].filter(Boolean).join(' ');
    result.push({
      id: `project:${project.id}`,
      title: project.title,
      sourceType: 'project',
      excerpt: cleanText(`${project.summary} ${detailText} Tags: ${project.tags.join(', ')}`),
      sourceUrl,
      projectSlug: project.id
    });
  }
  return result;
}

function isExplicitlyPublic(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return false;
  const record = metadata as Record<string, unknown>;
  return record.visibility === 'PUBLIC' || record.publicationStatus === 'PUBLIC';
}

function safeDocumentPath(root: string, storagePath: string) {
  const rootPath = path.resolve(root);
  const candidate = path.resolve(rootPath, storagePath);
  return candidate === rootPath || candidate.startsWith(`${rootPath}${path.sep}`) ? candidate : null;
}

export function getHostedPublicVectorStoreIds(config: Pick<ReturnType<typeof getAiConfig>, 'publicVectorStoreId' | 'publicVectorStoreConfirmed'>) {
  if (!config.publicVectorStoreConfirmed || !config.publicVectorStoreId) return [] as string[];
  return [config.publicVectorStoreId];
}

async function documentEvidence(config: ReturnType<typeof getAiConfig>) {
  const vectorStoreIds = getHostedPublicVectorStoreIds(config);
  if (!process.env.DATABASE_URL) return { evidence: [] as AiEvidence[], vectorStoreIds };
  try {
    const documents = await prisma.aiKnowledgeDocument.findMany({
      where: { status: 'PUBLISHED', includeInAi: true },
      select: { id: true, slug: true, title: true, storagePath: true, vectorStoreId: true, metadata: true }
    });
    const evidence: AiEvidence[] = [];
    for (const document of documents) {
      if (!isExplicitlyPublic(document.metadata)) continue;
      const metadata = document.metadata && typeof document.metadata === 'object' ? document.metadata as Record<string, unknown> : {};
      let content = cleanText(metadata.content);
      if (!content && document.storagePath) {
        const filePath = safeDocumentPath(config.knowledgeRoot, document.storagePath);
        if (filePath) {
          try { content = cleanText(await fs.readFile(filePath, 'utf8')); } catch { content = ''; }
        }
      }
      const excerpt = content || cleanText(metadata.excerpt);
      if (!excerpt) continue;
      evidence.push({
        id: `document:${document.slug}`,
        title: document.title,
        sourceType: 'document',
        excerpt,
        sourceUrl: typeof metadata.sourceUrl === 'string' && /^https:\/\//.test(metadata.sourceUrl) ? metadata.sourceUrl : undefined,
        vectorStoreId: document.vectorStoreId ?? undefined
      });
    }
    const pages = await prisma.cmsPage.findMany({
      where: { isPublished: true, blocks: { some: { visibility: 'PUBLIC', includeInAi: true } } },
      select: { slug: true, title: true, blocks: { where: { visibility: 'PUBLIC', includeInAi: true }, select: { blockKey: true, data: true }, orderBy: { sortOrder: 'asc' } } }
    });
    for (const page of pages) {
      const excerpt = page.blocks.map((block) => {
        if (!block.data || typeof block.data !== 'object') return '';
        return Object.values(block.data as Record<string, unknown>).filter((value): value is string => typeof value === 'string').join(' ');
      }).map(cleanText).filter(Boolean).join(' ');
      if (excerpt) evidence.push({ id: `page:${page.slug}`, title: page.title, sourceType: 'page', excerpt });
    }
    return { evidence, vectorStoreIds };
  } catch {
    return { evidence: [] as AiEvidence[], vectorStoreIds: [] as string[] };
  }
}

function scoreEvidence(item: AiEvidence, query: string, projectSlug?: string) {
  const haystack = `${item.title} ${item.excerpt} ${item.projectSlug ?? ''}`.toLowerCase();
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  let score = projectSlug && item.projectSlug === projectSlug ? 100 : 0;
  for (const term of terms) if (haystack.includes(term)) score += 1;
  return score;
}

export async function retrievePublicEvidence(query: string, projectSlug?: string): Promise<AiRetrieval> {
  const config = getAiConfig();
  const dynamic = await documentEvidence(config);
  const all = [...staticEvidence(), ...dynamic.evidence];
  const unique = Array.from(new Map(all.map((item) => [item.id, item])).values());
  return {
    evidence: unique.sort((left, right) => scoreEvidence(right, query, projectSlug) - scoreEvidence(left, query, projectSlug)).slice(0, 9),
    vectorStoreIds: dynamic.vectorStoreIds
  };
}

export function evidenceForPrompt(items: AiEvidence[]) {
  return items.map((item, index) => `[E${index + 1}] ${item.title} (${item.sourceType})\n${item.excerpt}`).join('\n\n');
}
