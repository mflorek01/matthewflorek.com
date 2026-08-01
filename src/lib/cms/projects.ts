import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { projectDraftSchema } from './schemas';
import { projectSnapshot, selectPublishedSnapshot, type ProjectSnapshot } from './snapshots';

async function nextProjectVersion(projectId: string) {
  const last = await prisma.projectRevision.findFirst({ where: { projectId }, orderBy: { version: 'desc' }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

export async function listProjects() {
  return prisma.project.findMany({ include: { category: true, links: { orderBy: { sortOrder: 'asc' } }, revisions: { orderBy: { version: 'desc' }, take: 5 } }, orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] });
}

export async function listCategories() {
  return prisma.projectCategory.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function getProject(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId }, include: { category: true, links: { orderBy: { sortOrder: 'asc' } }, assets: { orderBy: { createdAt: 'desc' } }, revisions: { orderBy: { version: 'desc' }, include: { createdBy: { select: { email: true, name: true } } } } } });
}

export async function saveProjectDraft(projectId: string, input: unknown, actorId: string) {
  const draft = projectDraftSchema.parse(input);
  const current = await prisma.project.findUnique({ where: { id: projectId }, include: { category: true, links: true } });
  if (!current) throw new Error('Project not found');
  const version = await nextProjectVersion(projectId);
  const snapshot: ProjectSnapshot = { ...draft };
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { slug: draft.slug, categoryId: draft.categoryId, title: draft.title, summary: draft.summary, details: draft.details as Prisma.InputJsonValue | undefined, publicationStatus: 'DRAFT', visibility: draft.visibility, sortOrder: draft.sortOrder, includeInAi: draft.includeInAi, source: draft.source ?? null, reviewNotes: draft.reviewNotes ?? null } });
    await tx.projectLink.deleteMany({ where: { projectId } });
    if (draft.links.length) await tx.projectLink.createMany({ data: draft.links.map((link) => ({ projectId, label: link.label, url: link.url, sortOrder: link.sortOrder })) });
    await tx.projectRevision.create({ data: { projectId, version, status: 'DRAFT', snapshot: snapshot as Prisma.InputJsonValue, createdById: actorId } });
    await tx.auditLog.create({ data: { actorId, action: 'project.draft_saved', entityType: 'Project', entityId: projectId, metadata: { version } } });
  });
  return getProject(projectId);
}

export async function publishProject(projectId: string, actorId: string) {
  if (getEnv().PUBLIC_CONTENT_MODE !== 'database') throw new Error('Publishing is unavailable while PUBLIC_CONTENT_MODE=static');
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { category: true, links: true } });
  if (!project) throw new Error('Project not found');
  if (project.visibility !== 'PUBLIC') throw new Error('A project must have PUBLIC visibility before it can be published');
  const snapshot = { ...projectSnapshot(project), publicationStatus: 'PUBLIC' as const };
  const version = await nextProjectVersion(projectId);
  await prisma.$transaction(async (tx) => {
    await tx.projectRevision.updateMany({ where: { projectId, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
    await tx.projectRevision.create({ data: { projectId, version, status: 'PUBLISHED', snapshot: snapshot as Prisma.InputJsonValue, createdById: actorId, publishedAt: new Date() } });
    await tx.project.update({ where: { id: projectId }, data: { publicationStatus: 'PUBLIC', visibility: snapshot.visibility, includeInAi: snapshot.includeInAi } });
    await tx.auditLog.create({ data: { actorId, action: 'project.published', entityType: 'Project', entityId: projectId, metadata: { version } } });
  });
  return getProject(projectId);
}

export async function restoreProjectRevision(projectId: string, revisionId: string, actorId: string) {
  const revision = await prisma.projectRevision.findFirst({ where: { id: revisionId, projectId } });
  if (!revision) throw new Error('Revision not found');
  const restored = projectDraftSchema.parse(revision.snapshot);
  return saveProjectDraft(projectId, restored, actorId);
}

export async function getPublishedProject(slug: string) {
  const project = await prisma.project.findUnique({ where: { slug }, include: { revisions: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } } });
  const snapshot = project ? selectPublishedSnapshot(project.revisions) : null;
  return snapshot ? projectDraftSchema.parse(snapshot) : null;
}
