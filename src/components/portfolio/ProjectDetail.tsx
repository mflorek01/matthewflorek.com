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
          <h1>{project.title}</h1>
          <p className="detail-lede">{project.summary}</p>
          <div className="tag-list large-tags">{project.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        </div>
        <AskAboutProject projectSlug={project.id} projectTitle={project.title} enabled={aiEnabled} />
      </div>
      <div className={`detail-grid${project.links.length ? '' : ' detail-grid-single'}`}>
        <section className="content-panel">
          <h2>About this project</h2>
          {project.details.context ? <div className="project-detail-section"><h3>The situation</h3><p>{project.details.context}</p></div> : null}
          {project.details.contribution ? <div className="project-detail-section"><h3>What I built</h3><p>{project.details.contribution}</p></div> : null}
          {project.details.outcome ? <div className="project-detail-section"><h3>Why it mattered</h3><p>{project.details.outcome}</p></div> : null}
          {!project.details.context && !project.details.contribution && !project.details.outcome ? <p>{project.summary}</p> : null}
        </section>
        {project.links.length ? <aside className="detail-sidebar">
          <div className="sidebar-card">
            <h2>Links</h2>
            {project.links.map((link) => (
              <TrackedLink key={link.url} href={link.url} event="project_source_clicked" properties={{ slug: project.id, source: link.label }} target="_blank" rel="noreferrer" className="button button-primary button-full">{link.label} <span aria-hidden="true">↗</span></TrackedLink>
            ))}
          </div>
        </aside> : null}
      </div>
      {related.length ? (
        <section className="related-section">
          <div className="section-heading"><h2>Related projects</h2></div>
          <div className="project-grid">{related.map((item) => <ProjectCard project={item} key={item.id} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
