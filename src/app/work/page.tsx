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
  return <SiteShell><section className="page-intro shell"><h1>Data systems built around real operational work.</h1><p className="page-lede">These projects began with familiar problems: scattered information, repetitive steps, difficult-to-audit decisions, and reporting that took too much effort. The descriptions stay appropriately high level, but the work and tools are real.</p></section><section className="shell page-section"><SectionHeading title="Selected work"><p>Search by project, tool, or theme. Open any card for a concise explanation of the problem and the approach.</p></SectionHeading><ProjectExplorer projects={projects} emptyTitle="No work projects are published yet." emptyCopy="Published work will appear here." /></section></SiteShell>;
}
