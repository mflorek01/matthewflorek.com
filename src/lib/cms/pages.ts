import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { pageDraftSchema } from './schemas';
import { pageSnapshot, selectPublishedSnapshot } from './snapshots';

async function nextPageVersion(pageId: string) {
  const last = await prisma.cmsPageRevision.findFirst({ where: { pageId }, orderBy: { version: 'desc' }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

export async function listPages() {
  return prisma.cmsPage.findMany({ include: { blocks: { orderBy: { sortOrder: 'asc' } }, revisions: { orderBy: { version: 'desc' }, take: 5 } }, orderBy: { slug: 'asc' } });
}

export async function getPage(pageId: string) {
  return prisma.cmsPage.findUnique({ where: { id: pageId }, include: { blocks: { orderBy: { sortOrder: 'asc' } }, revisions: { orderBy: { version: 'desc' }, include: { createdBy: { select: { email: true, name: true } } } } } });
}

export async function savePageDraft(pageId: string, input: unknown, actorId: string) {
  const draft = pageDraftSchema.parse(input);
  const page = await prisma.cmsPage.findUnique({ where: { id: pageId }, include: { blocks: true } });
  if (!page) throw new Error('Page not found');
  const version = await nextPageVersion(pageId);
  await prisma.$transaction(async (tx) => {
    await tx.cmsPage.update({ where: { id: pageId }, data: { title: draft.title } });
    await tx.cmsBlock.deleteMany({ where: { pageId } });
    if (draft.blocks.length) {
      await tx.cmsBlock.createMany({ data: draft.blocks.map((block) => ({ pageId, blockKey: block.blockKey, kind: block.kind, sortOrder: block.sortOrder, visibility: block.visibility, includeInAi: block.includeInAi, data: block.data as Prisma.InputJsonValue })) });
    }
    await tx.cmsPageRevision.create({ data: { pageId, version, status: 'DRAFT', snapshot: draft as Prisma.InputJsonValue, createdById: actorId } });
    await tx.auditLog.create({ data: { actorId, action: 'page.draft_saved', entityType: 'CmsPage', entityId: pageId, metadata: { version } } });
  });
  return getPage(pageId);
}

export async function publishPage(pageId: string, actorId: string) {
  if (getEnv().PUBLIC_CONTENT_MODE !== 'database') throw new Error('Publishing is unavailable while PUBLIC_CONTENT_MODE=static');
  const page = await prisma.cmsPage.findUnique({ where: { id: pageId }, include: { blocks: true } });
  if (!page) throw new Error('Page not found');
  const snapshot = pageSnapshot(page);
  const version = await nextPageVersion(pageId);
  await prisma.$transaction(async (tx) => {
    await tx.cmsPageRevision.updateMany({ where: { pageId, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    await tx.cmsPageRevision.create({ data: { pageId, version, status: 'PUBLISHED', snapshot: snapshot as Prisma.InputJsonValue, createdById: actorId, publishedAt: new Date() } });
    await tx.cmsPage.update({ where: { id: pageId }, data: { isPublished: true, publishedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId, action: 'page.published', entityType: 'CmsPage', entityId: pageId, metadata: { version } } });
  });
  return getPage(pageId);
}

export async function restorePageRevision(pageId: string, revisionId: string, actorId: string) {
  const revision = await prisma.cmsPageRevision.findFirst({ where: { id: revisionId, pageId } });
  if (!revision) throw new Error('Revision not found');
  const restored = pageDraftSchema.parse(revision.snapshot);
  return savePageDraft(pageId, restored, actorId);
}

export async function getPublishedPage(slug: string) {
  const page = await prisma.cmsPage.findUnique({ where: { slug }, include: { revisions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } } });
  const snapshot = page ? selectPublishedSnapshot(page.revisions) : null;
  return snapshot ? pageDraftSchema.parse(snapshot) : null;
}
