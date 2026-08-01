import type { CmsBlock, CmsPage, Project, ProjectCategory, ProjectLink } from '@prisma/client';
import type { PageDraft, ProjectDraft } from './schemas';

export type PageSnapshot = PageDraft;
export type ProjectSnapshot = ProjectDraft & { categorySlug?: string };

export function selectPublishedSnapshot<T extends { status: string; snapshot: unknown }>(revisions: T[]) {
  return revisions.find((revision) => revision.status === 'PUBLISHED')?.snapshot ?? null;
}

export function pageSnapshot(page: CmsPage & { blocks: CmsBlock[] }): PageSnapshot {
  return {
    title: page.title,
    blocks: [...page.blocks].sort((a, b) => a.sortOrder - b.sortOrder).map((block) => ({
      id: block.id,
      blockKey: block.blockKey,
      kind: block.kind,
      sortOrder: block.sortOrder,
      visibility: block.visibility,
      includeInAi: block.includeInAi,
      data: block.data as Record<string, unknown>
    }))
  };
}

export function projectSnapshot(project: Project & { category: ProjectCategory; links: ProjectLink[] }): ProjectSnapshot {
  return {
    slug: project.slug,
    categoryId: project.categoryId,
    categorySlug: project.category.slug,
    title: project.title,
    summary: project.summary,
    details: project.details ?? undefined,
    publicationStatus: project.publicationStatus,
    visibility: project.visibility,
    sortOrder: project.sortOrder,
    includeInAi: project.includeInAi,
    source: project.source,
    reviewNotes: project.reviewNotes,
    links: [...project.links].sort((a, b) => a.sortOrder - b.sortOrder).map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      sortOrder: link.sortOrder
    }))
  };
}
