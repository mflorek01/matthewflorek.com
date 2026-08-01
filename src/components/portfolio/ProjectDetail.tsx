import Link from 'next/link';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { PublicPortfolioProject } from '@/lib/content/portfolio';
import { AskAboutProject } from './AskAboutProject';
import { ProjectCard } from './ProjectCard';

export function ProjectDetail({ project, related, aiEnabled }: { project: PublicPortfolioProject; related: PublicPortfolioProject[]; aiEnabled: boolean }) {
  return (
    <div className="shell detail-page">
      <Link className="back-link" href={project.category === 'AI' ? '/ai' : '/work'}>← Back to {project.category === 'AI' ? 'AI projects' : 'work projects'}</Link>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">{project.category === 'AI' ? 'AI project' : 'Work project'}</p>
          <h1>{project.title}</h1>
          <p className="detail-lede">{project.summary}</p>
          <div className="tag-list large-tags">{project.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        </div>
        <AskAboutProject projectSlug={project.id} projectTitle={project.title} enabled={aiEnabled} />
      </div>
      <div className="detail-grid">
        <section className="content-panel">
          <p className="eyebrow">Project notes</p>
          <h2>A clear starting point</h2>
          <p>This page is intentionally grounded in the public description currently approved for this portfolio. Additional context, outcomes, and implementation details can be added through the editor after they have been reviewed.</p>
          <div className="evidence-placeholder">
            <span className="placeholder-icon" aria-hidden="true">＋</span>
            <div><strong>Evidence gallery placeholder</strong><p>Supporting screenshots, diagrams, or demos will appear here when reviewed media is published.</p></div>
          </div>
        </section>
        <aside className="detail-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Explore the source</p>
            {project.links.length ? project.links.map((link) => (
              <TrackedLink key={link.url} href={link.url} event="project_source_clicked" properties={{ slug: project.id, source: link.label }} target="_blank" rel="noreferrer" className="button button-primary button-full">{link.label} <span aria-hidden="true">↗</span></TrackedLink>
            )) : <p className="muted-copy">No public source link is available yet.</p>}
          </div>
          <div className="sidebar-card">
            <p className="eyebrow">Project status</p>
            <p className="status-line"><span className="status-dot" aria-hidden="true" /> Public portfolio entry</p>
            <p className="muted-copy">The page only includes information marked PUBLIC in the content source.</p>
          </div>
        </aside>
      </div>
      {related.length ? <section className="related-section"><div className="section-heading"><p className="eyebrow">Keep exploring</p><h2>Related projects</h2></div><div className="project-grid">{related.map((item) => <ProjectCard project={item} key={item.id} />)}</div></section> : null}
    </div>
  );
}
