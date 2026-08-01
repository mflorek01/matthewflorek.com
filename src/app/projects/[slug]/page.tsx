import { notFound } from 'next/navigation';
import { ProjectDetail } from '@/components/portfolio/ProjectDetail';
import { SiteShell } from '@/components/site/SiteShell';
import { getPublicProject, getPublicProjects, getPublicPortfolio } from '@/lib/content/portfolio';
import { resolvePreview } from '@/lib/content/preview';
import { getAiConfig } from '@/lib/ai/config';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getPublicProject(slug);
  return project ? { title: project.title, description: project.summary } : { title: 'Project' };
}

export function generateStaticParams() {
  return getPublicProjects().map((project) => ({ slug: project.id }));
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const preview = await resolvePreview(searchParams, `/projects/${slug}?preview=1`);
  const { projects } = await getPublicPortfolio({ preview });
  const project = projects.find((candidate) => candidate.id === slug);
  if (!project) notFound();
  const related = projects.filter((candidate) => candidate.id !== project.id && candidate.category === project.category).slice(0, 3);
  const aiEnabled = getAiConfig().enabled;
  return <SiteShell><ProjectDetail project={project} related={related} aiEnabled={aiEnabled} /></SiteShell>;
}
