import { SiteShell } from '@/components/site/SiteShell';
import { SectionHeading } from '@/components/site/SectionHeading';
import { ProjectExplorer } from '@/components/portfolio/ProjectExplorer';
import { getPublicPortfolio } from '@/lib/content/portfolio';
import { resolvePreview } from '@/lib/content/preview';
import { loadVisualPageDocument } from '@/lib/visual-editor';
import { VisualPage } from '@/components/site/VisualPage';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'AI Projects', description: 'Public experiments and products exploring AI-assisted software, research, and workflows.' };

export default async function AiProjectsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await resolvePreview(searchParams, '/ai?preview=1');
  const portfolio = await getPublicPortfolio({ preview });
  const visualDocument = await loadVisualPageDocument('ai', preview);
  if (visualDocument) return <SiteShell><VisualPage document={visualDocument} portfolio={portfolio} /></SiteShell>;
  const { projects: allProjects } = portfolio;
  const projects = allProjects.filter((project) => project.category === 'AI');
  return <SiteShell><section className="page-intro shell"><h1>Software experiments that grew into working products.</h1><p className="page-lede">I use AI as one part of a system—not as a substitute for product thinking, reliable data, or careful controls. These projects explore where it can make complicated tasks more useful and approachable.</p></section><section className="shell page-section"><SectionHeading title="Selected AI projects"><p>Each project explains what it is, why I built it, and what I learned from making it work.</p></SectionHeading><ProjectExplorer projects={projects} emptyTitle="No AI projects are published yet." emptyCopy="Published projects will appear here." /></section></SiteShell>;
}
