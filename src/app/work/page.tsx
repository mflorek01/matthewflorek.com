import { SiteShell } from '@/components/site/SiteShell';
import { SectionHeading } from '@/components/site/SectionHeading';
import { ProjectExplorer } from '@/components/portfolio/ProjectExplorer';
import { getPublicPortfolio } from '@/lib/content/portfolio';
import { resolvePreview } from '@/lib/content/preview';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Work Projects', description: 'Selected work in data analytics, operations, automation, and business intelligence.' };

export default async function WorkProjectsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await resolvePreview(searchParams, '/work?preview=1');
  const { projects: allProjects } = await getPublicPortfolio({ preview });
  const projects = allProjects.filter((project) => project.category === 'WORK');
  return <SiteShell><section className="page-intro shell"><p className="eyebrow">Work projects</p><h1>Systems that make complex work easier to see.</h1><p className="page-lede">A growing collection of work in analytics, data quality, reporting, and workflow automation. The project queue is intentionally conservative while employer-derived material is reviewed.</p></section><section className="shell page-section"><SectionHeading eyebrow="Project library" title="Work, with the right context." ><p>Search the published project notes by theme. More work projects will appear once their public descriptions are approved.</p></SectionHeading><ProjectExplorer projects={projects} emptyTitle="Work projects are being reviewed." emptyCopy="The source inventory contains work projects, but none are marked PUBLIC yet. This page will populate as approved entries move through the editor." /></section></SiteShell>;
}
