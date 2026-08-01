import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { deterministicProjectSlug, hashMetamorphysisExport } from './hash';
import { diffProject, summarizeDiffs, type OverrideMap } from './diff';
import { metamorphysisProjectSchema, parseMetamorphysisExport, type MetamorphysisProject } from './schema';

type JsonRecord = Record<string, unknown>;

function asSourceProject(value: unknown): MetamorphysisProject | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as JsonRecord;
  const candidate = record.sourceProject ?? value;
  const parsed = parseMetamorphysisExport({ sourceVersion: 'stored', projects: [candidate] });
  return parsed.projects[0] ?? null;
}

function safeOverrides(value: Prisma.JsonValue | null | undefined): OverrideMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function projectData(effective: MetamorphysisProject): Prisma.ProjectUpdateInput {
  return {
    title: effective.title,
    summary: effective.summary,
    details: effective.details,
    source: 'metamorphysis',
    reviewNotes: 'Imported from Metamorphysis; review before publishing.',
    category: { connect: { slug: effective.category.toLowerCase() } }
  };
}

export async function syncMetamorphysisExport(input: unknown, actorId?: string) {
  const payload = parseMetamorphysisExport(input);
  const sourceHash = hashMetamorphysisExport(payload);
  const existing = await prisma.metamorphysisImportSnapshot.findUnique({ where: { sourceVersion_sourceHash: { sourceVersion: payload.sourceVersion, sourceHash } }, include: { projectLinks: true } });
  if (existing) {
    await prisma.metamorphysisSyncState.upsert({ where: { id: 'default' }, update: { status: 'SUCCEEDED', lastFinishedAt: new Date(), lastSnapshotId: existing.id, errorMessage: null }, create: { id: 'default', status: 'SUCCEEDED', lastFinishedAt: new Date(), lastSnapshotId: existing.id } });
    return { idempotent: true, snapshotId: existing.id, sourceHash, summary: { changedProjects: [], conflicts: [], reviewRequired: false } };
  }

  await prisma.metamorphysisSyncState.upsert({ where: { id: 'default' }, update: { status: 'RUNNING', lastStartedAt: new Date(), errorMessage: null }, create: { id: 'default', status: 'RUNNING', lastStartedAt: new Date() } });
  try {
    const previous = await prisma.metamorphysisImportSnapshot.findFirst({ orderBy: { importedAt: 'desc' }, include: { projectLinks: true } });
    const previousByExternal = new Map((previous?.projectLinks ?? []).map((link) => [link.externalProjectId, asSourceProject(link.importedPayload)]));
    const created = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.metamorphysisImportSnapshot.create({ data: { sourceVersion: payload.sourceVersion, sourceHash, sourceUpdatedAt: payload.sourceUpdatedAt ? new Date(payload.sourceUpdatedAt) : null, payload } });
      const summaries: Array<{ externalProjectId: string; diff: ReturnType<typeof diffProject> }> = [];
      for (const source of payload.projects) {
        const priorLink = previous?.projectLinks.find((link) => link.externalProjectId === source.id);
        const existingProject = priorLink?.projectId ? await tx.project.findUnique({ where: { id: priorLink.projectId }, include: { override: true } }) : null;
        const diff = diffProject(previousByExternal.get(source.id) ?? null, source, safeOverrides(existingProject?.override?.fields));
        summaries.push({ externalProjectId: source.id, diff });
        let project = existingProject;
        if (!project) {
          const category = await tx.projectCategory.upsert({ where: { slug: source.category.toLowerCase() }, update: {}, create: { slug: source.category.toLowerCase(), name: source.category === 'AI' ? 'AI Projects' : 'Work Projects' } });
          project = await tx.project.create({ data: { slug: deterministicProjectSlug(source), categoryId: category.id, title: source.title, summary: source.summary, details: source.details, publicationStatus: 'NEEDS_REVIEW', visibility: 'PRIVATE', sortOrder: 0, includeInAi: false, source: 'metamorphysis', reviewNotes: 'Imported from Metamorphysis; review before publishing.' }, include: { override: true } });
        } else {
          await tx.project.update({ where: { id: project.id }, data: projectData(diff.effective) });
          await tx.projectLink.deleteMany({ where: { projectId: project.id } });
        }
        if (!project) throw new Error(`Could not create local project for ${source.id}`);
        for (const [index, link] of source.links.entries()) await tx.projectLink.create({ data: { projectId: project.id, label: link.label, url: link.url, sortOrder: index } });
        const importedPayload = JSON.parse(JSON.stringify({ sourceProject: source, diff: diff.changes, conflicts: diff.conflicts, reviewRequired: diff.reviewRequired })) as Prisma.InputJsonValue;
        await tx.metamorphysisProjectLink.create({ data: { snapshotId: snapshot.id, projectId: project.id, externalProjectId: source.id, importedTitle: source.title, importedPayload } });
      }
      const summary = summarizeDiffs(summaries);
      await tx.metamorphysisSyncState.update({ where: { id: 'default' }, data: { status: 'SUCCEEDED', lastFinishedAt: new Date(), lastSnapshotId: snapshot.id, cursor: JSON.stringify(summary), errorMessage: null } });
      await tx.auditLog.create({ data: { actorId, action: 'metamorphysis.import', entityType: 'MetamorphysisImportSnapshot', entityId: snapshot.id, metadata: { sourceVersion: payload.sourceVersion, sourceHash, projectCount: payload.projects.length, ...summary } } });
      return { snapshot, summary };
    });
    return { idempotent: false, snapshotId: created.snapshot.id, sourceHash, summary: created.summary };
  } catch (error) {
    await prisma.metamorphysisSyncState.update({ where: { id: 'default' }, data: { status: 'FAILED', lastFinishedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Metamorphysis sync failed' } }).catch(() => undefined);
    await prisma.auditLog.create({ data: { actorId, action: 'metamorphysis.sync_failed', entityType: 'MetamorphysisImportSnapshot', metadata: { sourceVersion: payload.sourceVersion } } }).catch(() => undefined);
    throw error;
  }
}

export async function getMetamorphysisSyncOverview() {
  const [state, snapshot] = await Promise.all([
    prisma.metamorphysisSyncState.findUnique({ where: { id: 'default' } }),
    prisma.metamorphysisImportSnapshot.findFirst({ orderBy: { importedAt: 'desc' }, include: { projectLinks: { include: { project: { include: { override: true } } } } } })
  ]);
  return { state, snapshot };
}

export async function approveMetamorphysisProject(externalProjectId: string, snapshotId?: string, actorId?: string) {
  const snapshot = snapshotId ? await prisma.metamorphysisImportSnapshot.findUnique({ where: { id: snapshotId }, include: { projectLinks: true } }) : await prisma.metamorphysisImportSnapshot.findFirst({ orderBy: { importedAt: 'desc' }, include: { projectLinks: true } });
  const link = snapshot?.projectLinks.find((candidate) => candidate.externalProjectId === externalProjectId);
  if (!link?.projectId) throw new Error('Imported project was not found');
  const project = await prisma.project.update({ where: { id: link.projectId }, data: { publicationStatus: 'DRAFT', visibility: 'UNLISTED', reviewNotes: 'Approved for local editing; not published.' } });
  await prisma.auditLog.create({ data: { actorId, action: 'metamorphysis.project_approved', entityType: 'Project', entityId: project.id, metadata: { snapshotId: snapshot?.id, externalProjectId } } });
  return project;
}

export async function saveMetamorphysisOverrides(projectId: string, fields: OverrideMap, actorId?: string) {
  const allowed = ['title', 'summary', 'category', 'tags', 'links', 'details'] as const;
  const candidate = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed.includes(key as typeof allowed[number])));
  const validated = metamorphysisProjectSchema.partial().strict().parse({ id: 'override', ...candidate });
  const sanitized = Object.fromEntries(Object.keys(candidate).map((key) => [key, validated[key as keyof typeof validated]]).filter(([, value]) => value !== undefined)) as Prisma.InputJsonObject;
  const override = await prisma.projectOverride.upsert({ where: { projectId }, update: { fields: sanitized, createdById: actorId }, create: { projectId, fields: sanitized, createdById: actorId } });
  await prisma.auditLog.create({ data: { actorId, action: 'metamorphysis.override_saved', entityType: 'ProjectOverride', entityId: override.id, metadata: { projectId, fields: Object.keys(sanitized) } } });
  return override;
}
