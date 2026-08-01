import { SiteShell } from '@/components/site/SiteShell';
import { SectionHeading } from '@/components/site/SectionHeading';
import { ProjectExplorer } from '@/components/portfolio/ProjectExplorer';
import { getPublicPortfolio } from '@/lib/content/portfolio';
import { resolvePreview } from '@/lib/content/preview';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'AI Projects', description: 'Public experiments and products exploring AI-assisted software, research, and workflows.' };

export default async function AiProjectsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await resolvePreview(searchParams, '/ai?preview=1');
  const { projects: allProjects } = await getPublicPortfolio({ preview });
  const projects = allProjects.filter((project) => project.category === 'AI');
  return <SiteShell><section className="page-intro shell"><p className="eyebrow">AI projects</p><h1>Useful intelligence, shaped into tools.</h1><p className="page-lede">Experiments and products around AI-assisted development, structured knowledge, and practical interfaces. Each entry stays close to what is currently public.</p></section><section className="shell page-section"><SectionHeading eyebrow="Project library" title="Explore the experiments."><p>Open a project for its public summary, source links, and a place for future reviewed evidence.</p></SectionHeading><ProjectExplorer projects={projects} emptyTitle="AI projects are being prepared." emptyCopy="No AI project is marked PUBLIC yet. Once an entry is approved, it will appear here with its own shareable detail page." /></section></SiteShell>;
}
