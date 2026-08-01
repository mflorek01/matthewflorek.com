import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sourcePath = resolve(process.cwd(), 'content/portfolio-source.json');
const publicationStatuses = new Set(['PUBLIC', 'DRAFT', 'NEEDS_REVIEW', 'ARCHIVED']);
const categorySlugs = new Map([
  ['WORK', 'work-projects'],
  ['AI', 'ai-projects']
]);

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function statusOf(value) {
  return publicationStatuses.has(value) ? value : 'DRAFT';
}

function visibilityOf(status) {
  return status === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
}

function categoryOf(value) {
  return categorySlugs.has(value) ? value : null;
}

function provenanceOf(value) {
  return arrayOf(value)
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .join('\n') || null;
}

function httpUrlOf(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourceRecords(source) {
  if (!source || typeof source !== 'object') throw new Error('content/portfolio-source.json must contain an object');
  const projects = arrayOf(source.projects);
  return { projects };
}

async function main() {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const { projects } = sourceRecords(source);
  const categories = new Map([
    ['WORK', await prisma.projectCategory.upsert({
      where: { slug: 'work-projects' },
      update: { name: 'Work Projects', sortOrder: 0 },
      create: { slug: 'work-projects', name: 'Work Projects', sortOrder: 0 }
    })],
    ['AI', await prisma.projectCategory.upsert({
      where: { slug: 'ai-projects' },
      update: { name: 'AI Projects', sortOrder: 1 },
      create: { slug: 'ai-projects', name: 'AI Projects', sortOrder: 1 }
    })]
  ]);

  const overviewPage = await prisma.cmsPage.upsert({
    where: { slug: 'overview' },
    update: { title: source.overview?.name ?? 'Overview', isPublished: source.overview?.publicationStatus === 'PUBLIC' },
    create: { slug: 'overview', title: source.overview?.name ?? 'Overview', isPublished: source.overview?.publicationStatus === 'PUBLIC' }
  });

  const overviewPublic = source.overview?.publicationStatus === 'PUBLIC';
  const overviewSnapshot = { overview: source.overview ?? {}, githubRepositories: source.githubRepositories ?? [] };
  await prisma.cmsBlock.upsert({
    where: { pageId_blockKey: { pageId: overviewPage.id, blockKey: 'overview-content' } },
    update: { kind: 'overview', sortOrder: 0, visibility: overviewPublic ? 'PUBLIC' : 'PRIVATE', includeInAi: overviewPublic && source.overview?.includeInAi === true, data: overviewSnapshot },
    create: { pageId: overviewPage.id, blockKey: 'overview-content', kind: 'overview', sortOrder: 0, visibility: overviewPublic ? 'PUBLIC' : 'PRIVATE', includeInAi: overviewPublic && source.overview?.includeInAi === true, data: overviewSnapshot }
  });
  await prisma.cmsPageRevision.upsert({
    where: { pageId_version: { pageId: overviewPage.id, version: 1 } },
    update: {},
    create: { pageId: overviewPage.id, version: 1, status: overviewPublic ? 'PUBLISHED' : 'DRAFT', snapshot: overviewSnapshot, publishedAt: overviewPublic ? new Date() : null }
  });

  const categoryOrders = new Map([['WORK', 0], ['AI', 0]]);
  for (const item of projects) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim()) {
      console.warn('Skipping project without a non-empty id.');
      continue;
    }
    const publicationStatus = statusOf(item.publicationStatus);
    const isPublic = publicationStatus === 'PUBLIC';
    const categoryKey = categoryOf(item.category);
    const category = categoryKey ? categories.get(categoryKey) : undefined;
    if (!category || !categoryKey) {
      console.warn(`Skipping project ${item.id}: category must be WORK or AI.`);
      continue;
    }
    const sortOrder = categoryOrders.get(categoryKey) ?? 0;
    categoryOrders.set(categoryKey, sortOrder + 1);
    const project = await prisma.project.upsert({
      where: { slug: item.id.trim() },
      update: {
        categoryId: category.id,
        title: typeof item.title === 'string' ? item.title.trim() : item.id.trim(),
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        details: item.details ?? null,
        publicationStatus,
        visibility: visibilityOf(publicationStatus),
        sortOrder,
        includeInAi: isPublic && item.includeInAi === true,
        source: provenanceOf(item.provenance),
        reviewNotes: item.reviewNotes ?? null
      },
      create: {
        slug: item.id.trim(),
        categoryId: category.id,
        title: typeof item.title === 'string' ? item.title.trim() : item.id.trim(),
        summary: typeof item.summary === 'string' ? item.summary.trim() : '',
        details: item.details ?? null,
        publicationStatus,
        visibility: visibilityOf(publicationStatus),
        sortOrder,
        includeInAi: isPublic && item.includeInAi === true,
        source: provenanceOf(item.provenance),
        reviewNotes: item.reviewNotes ?? null
      }
    });

    await prisma.projectLink.deleteMany({ where: { projectId: project.id } });
    for (const [linkIndex, link] of arrayOf(item.links).entries()) {
      const url = httpUrlOf(link?.url);
      const label = typeof link?.label === 'string' ? link.label.trim() : '';
      if (url && label) {
        await prisma.projectLink.create({ data: { projectId: project.id, label, url, sortOrder: linkIndex } });
      }
    }

    const snapshot = { ...item, publicationStatus, visibility: visibilityOf(publicationStatus), includeInAi: isPublic && item.includeInAi === true };
    await prisma.projectRevision.upsert({
      where: { projectId_version: { projectId: project.id, version: 1 } },
      update: {},
      create: { projectId: project.id, version: 1, status: isPublic ? 'PUBLISHED' : 'DRAFT', snapshot, publishedAt: isPublic ? new Date() : null }
    });
  }

  await prisma.metamorphysisSyncState.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', status: 'IDLE' }
  });

  console.log(`Seeded overview, ${projects.length} projects, and Metamorphysis sync state.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
