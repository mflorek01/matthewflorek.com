import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

if (process.env.CONFIRM_CONTENT_REFRESH !== 'YES') {
  throw new Error('Set CONFIRM_CONTENT_REFRESH=YES to apply the curated content refresh.');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(scriptDir, '../../content/portfolio-source.json');
const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const publicProjects = source.projects.filter((project) => project?.publicationStatus === 'PUBLIC');
const prisma = new PrismaClient();

function nextVersion(revisions) {
  return revisions.reduce((highest, revision) => Math.max(highest, revision.version), 0) + 1;
}

function sameSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function overviewSnapshot() {
  return { overview: source.overview, githubRepositories: source.githubRepositories ?? [] };
}

function projectSnapshot(item) {
  const details = { ...(item.details ?? {}), tags: item.tags ?? [] };
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    summary: item.summary,
    details,
    tags: item.tags ?? [],
    links: item.links ?? [],
    publicationStatus: 'PUBLIC',
    visibility: 'PUBLIC',
    includeInAi: item.includeInAi === true
  };
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const page = await tx.cmsPage.findUnique({
      where: { slug: 'overview' },
      include: { revisions: { orderBy: { version: 'desc' }, take: 1 } }
    });
    if (!page) throw new Error('Overview CMS page was not found; run the normal seed first.');

    const snapshot = overviewSnapshot();
    await tx.cmsPage.update({
      where: { id: page.id },
      data: { title: source.overview.name, isPublished: true, publishedAt: new Date() }
    });
    await tx.cmsBlock.update({
      where: { pageId_blockKey: { pageId: page.id, blockKey: 'overview-content' } },
      data: { kind: 'overview', visibility: 'PUBLIC', includeInAi: source.overview.includeInAi === true, data: snapshot }
    });
    const overviewRevision = page.revisions[0]?.status === 'PUBLISHED' && sameSnapshot(page.revisions[0]?.snapshot, snapshot)
      ? page.revisions[0]
      : await (async () => {
        await tx.cmsPageRevision.updateMany({ where: { pageId: page.id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
        return tx.cmsPageRevision.create({
          data: { pageId: page.id, version: nextVersion(page.revisions), status: 'PUBLISHED', snapshot, publishedAt: new Date() }
        });
      })();

    const projects = [];
    for (const item of publicProjects) {
      const project = await tx.project.findUnique({ where: { slug: item.id } });
      if (!project) throw new Error(`Curated PUBLIC project not found: ${item.id}`);
      if (project.publicationStatus !== 'PUBLIC') throw new Error(`Refusing to change non-PUBLIC project: ${item.id}`);
      const revisions = await tx.projectRevision.findMany({ where: { projectId: project.id }, orderBy: { version: 'desc' }, take: 1 });
      const snapshot = projectSnapshot(item);
      const persistedDetails = { ...(item.details ?? {}), tags: item.tags ?? [] };
      await tx.project.update({
        where: { id: project.id },
        data: {
          title: item.title,
          summary: item.summary,
          details: persistedDetails,
          publicationStatus: 'PUBLIC',
          visibility: 'PUBLIC',
          includeInAi: item.includeInAi === true
        }
      });
      const revision = revisions[0]?.status === 'PUBLISHED' && sameSnapshot(revisions[0]?.snapshot, snapshot)
        ? revisions[0]
        : await (async () => {
          await tx.projectRevision.updateMany({ where: { projectId: project.id, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
          return tx.projectRevision.create({
            data: { projectId: project.id, version: nextVersion(revisions), status: 'PUBLISHED', snapshot, publishedAt: new Date() }
          });
        })();
      projects.push({ slug: item.id, revision: revision.version });
    }
    return { overviewRevision: overviewRevision.version, projects };
  });
  console.log(JSON.stringify({ applied: true, overviewRevision: result.overviewRevision, publicProjects: result.projects }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
