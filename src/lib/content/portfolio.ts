import source from '../../../content/portfolio-source.json';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';

export type PublicationStatus = 'PUBLIC' | 'DRAFT' | 'NEEDS_REVIEW';
export type ProjectCategory = 'WORK' | 'AI';

export type PortfolioLink = {
  label: string;
  url: string;
  visibility?: string;
  publicationStatus?: PublicationStatus;
};

export type PortfolioProject = {
  id: string;
  category: ProjectCategory;
  title: string;
  publicationStatus: PublicationStatus;
  summary: string;
  tags: string[];
  links: PortfolioLink[];
  includeInAi: boolean;
  reviewNotes?: string;
  source?: string;
};

export type PublicPortfolioProject = {
  id: string;
  category: ProjectCategory;
  title: string;
  summary: string;
  tags: string[];
  links: Array<{ label: string; url: string }>;
};
export type PublicOverview = {
  name: string;
  headline: string;
  shortBio: string;
  longBio: string;
  education: Array<{ credential: string; institution: string; year: string }>;
  skills: string[];
  links: Array<{ label: string; url: string }>;
  resumeAsset: { path: string } | null;
  portraitAsset: { path: string } | null;
};

export type PortfolioContent = {
  overview: PublicOverview;
  projects: PublicPortfolioProject[];
  githubRepositories: Array<{ name: string; url: string }>;
};

type InternalPortfolioContent = {
  overview: {
    publicationStatus: PublicationStatus;
    name: string;
    headline: string;
    shortBio: string;
    longBio: string;
    education: Array<{ credential: string; institution: string; year: string; publicationStatus: PublicationStatus }>;
    skills: string[];
    links: PortfolioLink[];
    resumeAsset: { path: string; publicationStatus?: PublicationStatus } | null;
    portraitAsset: { path: string; publicationStatus?: PublicationStatus } | null;
    includeInAi: boolean;
  };
  projects: PortfolioProject[];
  githubRepositories: Array<{ name: string; url: string; publicationStatus: PublicationStatus }>;
};

type PortfolioSource = {
  overview: {
    publicationStatus: PublicationStatus;
    name: string;
    headline: string;
    shortBio: string;
    longBio: string;
    education: Array<{ credential: string; institution: string; year: string; publicationStatus: PublicationStatus }>;
    skills: string[];
    links: PortfolioLink[];
    resumeAsset: { path: string; publicationStatus: PublicationStatus };
    portraitAsset: { path: string; publicationStatus: PublicationStatus };
    includeInAi: boolean;
  };
  projects: PortfolioProject[];
  githubRepositories: Array<{ name: string; url: string; publicationStatus: PublicationStatus }>;
};

const portfolio = source as PortfolioSource;

function isPublic(status: PublicationStatus) {
  return status === 'PUBLIC';
}

function publicLink(link: PortfolioLink) {
  return isPublic(link.publicationStatus ?? 'DRAFT') && link.visibility !== 'PRIVATE';
}

export const publicOverview = isPublic(portfolio.overview.publicationStatus) ? {
  name: portfolio.overview.name,
  headline: portfolio.overview.headline,
  shortBio: portfolio.overview.shortBio,
  longBio: portfolio.overview.longBio,
  links: portfolio.overview.links.filter(publicLink).map(({ label, url }) => ({ label, url })),
  education: portfolio.overview.education.filter((item) => isPublic(item.publicationStatus)).map(({ credential, institution, year }) => ({ credential, institution, year })),
  skills: portfolio.overview.skills,
  resumeAsset: isPublic(portfolio.overview.resumeAsset.publicationStatus) ? { path: portfolio.overview.resumeAsset.path } : null,
  portraitAsset: isPublic(portfolio.overview.portraitAsset.publicationStatus) ? { path: portfolio.overview.portraitAsset.path } : null
} : {
  name: '',
  headline: '',
  shortBio: '',
  longBio: '',
  education: [],
  skills: [],
  links: [],
  resumeAsset: null,
  portraitAsset: null
};

export const publicProjects = portfolio.projects
  .filter((project) => isPublic(project.publicationStatus))
  .map(({ id, category, title, summary, tags, links }) => ({ id, category, title, summary, tags, links: links.filter(publicLink).map(({ label, url }) => ({ label, url })) }));

export const aiOverview = { ...publicOverview, includeInAi: isPublic(portfolio.overview.publicationStatus) && portfolio.overview.includeInAi };

export const aiProjects = portfolio.projects
  .filter((project) => isPublic(project.publicationStatus) && project.includeInAi)
  .map(({ id, category, title, publicationStatus, summary, tags, links, includeInAi }) => ({ id, category, title, publicationStatus, summary, tags, links: links.filter(publicLink).map(({ label, url }) => ({ label, url })), includeInAi }));

export const publicGithubRepositories = portfolio.githubRepositories.filter((repository) => isPublic(repository.publicationStatus)).map(({ name, url }) => ({ name, url }));

function toPublicContent(content: InternalPortfolioContent): PortfolioContent {
  return {
    overview: {
      name: content.overview.name,
      headline: content.overview.headline,
      shortBio: content.overview.shortBio,
      longBio: content.overview.longBio,
      education: content.overview.education.map(({ credential, institution, year }) => ({ credential, institution, year })),
      skills: content.overview.skills,
      links: content.overview.links.map(({ label, url }) => ({ label, url })),
      resumeAsset: content.overview.resumeAsset ? { path: content.overview.resumeAsset.path } : null,
      portraitAsset: content.overview.portraitAsset ? { path: content.overview.portraitAsset.path } : null
    },
    projects: content.projects.map(({ id, category, title, summary, tags, links }) => ({ id, category, title, summary, tags, links: links.map(({ label, url }) => ({ label, url })) })),
    githubRepositories: content.githubRepositories.map(({ name, url }) => ({ name, url }))
  };
}

const staticContent: PortfolioContent = toPublicContent({
  overview: portfolio.overview,
  projects: portfolio.projects.filter((project) => isPublic(project.publicationStatus)),
  githubRepositories: portfolio.githubRepositories
});

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];
}

function publicUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function overviewFromDatabase(value: unknown, preview: boolean) {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const overview = record.overview && typeof record.overview === 'object' ? record.overview as Record<string, unknown> : record;
  const status = stringValue(overview.publicationStatus, 'DRAFT') as PublicationStatus;
  const links = Array.isArray(overview.links) ? overview.links.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const link = item as Record<string, unknown>;
    const url = publicUrl(link.url);
    if (!url || (!preview && (!isPublic(stringValue(link.publicationStatus, 'DRAFT') as PublicationStatus) || link.visibility === 'PRIVATE'))) return [];
    return [{ label: stringValue(link.label, 'Link'), url, visibility: stringValue(link.visibility, 'PUBLIC'), publicationStatus: (stringValue(link.publicationStatus, 'PUBLIC') as PublicationStatus) }];
  }) : [];
  const education = Array.isArray(overview.education) ? overview.education.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    if (!preview && !isPublic(stringValue(entry.publicationStatus, 'DRAFT') as PublicationStatus)) return [];
    return [{ credential: stringValue(entry.credential), institution: stringValue(entry.institution), year: stringValue(entry.year), publicationStatus: stringValue(entry.publicationStatus, 'PUBLIC') as PublicationStatus }];
  }) : [];
  const published = preview || isPublic(status);
  const resume = overview.resumeAsset && typeof overview.resumeAsset === 'object' ? overview.resumeAsset as Record<string, unknown> : null;
  const portrait = overview.portraitAsset && typeof overview.portraitAsset === 'object' ? overview.portraitAsset as Record<string, unknown> : null;
  return {
    publicationStatus: published ? 'PUBLIC' as const : status,
    name: published ? stringValue(overview.name) : '',
    headline: published ? stringValue(overview.headline) : '',
    shortBio: published ? stringValue(overview.shortBio) : '',
    longBio: published ? stringValue(overview.longBio) : '',
    education: published ? education : [],
    skills: published ? stringArray(overview.skills) : [],
    links: published ? links : [],
    resumeAsset: published && resume && isPublic(stringValue(resume.publicationStatus, 'DRAFT') as PublicationStatus) ? { path: stringValue(resume.path) } : null,
    portraitAsset: published && portrait && isPublic(stringValue(portrait.publicationStatus, 'DRAFT') as PublicationStatus) ? { path: stringValue(portrait.path) } : null,
    includeInAi: published && overview.includeInAi === true
  };
}

function projectFromDatabase(row: { slug: string; title: string; summary: string; details: unknown; publicationStatus: string; visibility: string; sortOrder: number; includeInAi: boolean; source: string | null; reviewNotes: string | null; category: { slug: string }; links: Array<{ label: string; url: string; sortOrder: number }>; }, snapshot: unknown, preview: boolean): PortfolioProject {
  const snapshotRecord = snapshot && typeof snapshot === 'object' ? snapshot as Record<string, unknown> : {};
  const details = snapshotRecord.details && typeof snapshotRecord.details === 'object' ? snapshotRecord.details as Record<string, unknown> : row.details;
  const detailRecord = details && typeof details === 'object' ? details as Record<string, unknown> : {};
  const category: ProjectCategory = row.category.slug === 'ai-projects' ? 'AI' : 'WORK';
  const links = Array.isArray(snapshotRecord.links) ? snapshotRecord.links.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const link = item as Record<string, unknown>;
    const url = publicUrl(link.url);
    return url && (preview || link.visibility !== 'PRIVATE') ? [{ label: stringValue(link.label, 'Source'), url, publicationStatus: 'PUBLIC' as const }] : [];
  }) : row.links.map((link) => ({ label: link.label, url: link.url, publicationStatus: 'PUBLIC' as const }));
  return {
    id: stringValue(snapshotRecord.slug, row.slug),
    category,
    title: stringValue(snapshotRecord.title, row.title),
    publicationStatus: 'PUBLIC',
    summary: stringValue(snapshotRecord.summary, row.summary),
    tags: stringArray(detailRecord.tags),
    links,
    includeInAi: preview ? (snapshotRecord.includeInAi === true || row.includeInAi) : snapshotRecord.includeInAi === true,
    reviewNotes: stringValue(snapshotRecord.reviewNotes, row.reviewNotes ?? '') || undefined
  };
}

async function loadDatabaseContent(preview: boolean): Promise<PortfolioContent> {
  const page = await prisma.cmsPage.findUnique({ where: { slug: 'overview' }, include: { blocks: { orderBy: { sortOrder: 'asc' } }, revisions: { where: preview ? undefined : { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } } });
  const revision = page?.revisions[0];
  const pageSnapshot = revision?.snapshot ?? (preview ? { blocks: page?.blocks ?? [] } : null);
  const pageRecord = pageSnapshot && typeof pageSnapshot === 'object' ? pageSnapshot as Record<string, unknown> : {};
  const blocks = Array.isArray(pageRecord.blocks) ? pageRecord.blocks : pageRecord.blocks === undefined ? page?.blocks?.map((block) => ({ kind: block.kind, data: block.data, visibility: block.visibility })) ?? [] : [];
  const overviewBlock = blocks.find((block) => block && typeof block === 'object' && ((block as Record<string, unknown>).kind === 'overview' || (block as Record<string, unknown>).blockKey === 'overview-content')) as Record<string, unknown> | undefined;
  const overviewData = overviewBlock?.data ?? pageRecord;
  const overview = overviewFromDatabase(overviewData, preview);
  const githubRaw = overviewData && typeof overviewData === 'object' && Array.isArray((overviewData as Record<string, unknown>).githubRepositories) ? (overviewData as Record<string, unknown>).githubRepositories as unknown[] : [];
  const githubRepositories = githubRaw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const repository = item as Record<string, unknown>;
    const url = publicUrl(repository.url);
    if (!url || (!preview && !isPublic(stringValue(repository.publicationStatus, 'DRAFT') as PublicationStatus))) return [];
    return [{ name: stringValue(repository.name, 'Repository'), url, publicationStatus: 'PUBLIC' as const }];
  });

  const rows = await prisma.project.findMany({ include: { category: true, links: { orderBy: { sortOrder: 'asc' } }, revisions: { where: preview ? undefined : { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } }, orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] });
  const projects = rows.flatMap((row) => {
    const revision = row.revisions[0];
    if (!preview && !revision) return [];
    const snapshotRecord = revision?.snapshot && typeof revision.snapshot === 'object' ? revision.snapshot as Record<string, unknown> : {};
    if (!preview && (stringValue(snapshotRecord.publicationStatus, row.publicationStatus) !== 'PUBLIC' || stringValue(snapshotRecord.visibility, row.visibility) !== 'PUBLIC')) return [];
    return [projectFromDatabase(row, revision?.snapshot ?? row, preview)];
  });
  return toPublicContent({ overview, projects, githubRepositories });
}

export async function getPublicPortfolio(options: { preview?: boolean } = {}) {
  const mode = getEnv().PUBLIC_CONTENT_MODE;
  if (mode === 'static') return staticContent;
  return loadDatabaseContent(options.preview === true);
}

export function getPublicProjects(category?: ProjectCategory) {
  return category ? publicProjects.filter((project) => project.category === category) : publicProjects;
}

export function getPublicProject(slug: string) {
  return publicProjects.find((project) => project.id === slug);
}

export function getRelatedProjects(project: PublicPortfolioProject, limit = 3) {
  return publicProjects.filter((candidate) => candidate.id !== project.id && candidate.category === project.category).slice(0, limit);
}
