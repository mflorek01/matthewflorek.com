import Link from 'next/link';
import { TrackedLink } from '@/components/analytics/TrackedLink';
import type { PublicPortfolioProject } from '@/lib/content/portfolio';

export function ProjectCard({ project }: { project: PublicPortfolioProject }) {
  return (
    <article className="project-card">
      <div className="project-card-topline">
        <span className="project-category">{project.category === 'AI' ? 'AI project' : 'Work project'}</span>
        <span className="project-arrow" aria-hidden="true">↗</span>
      </div>
      <h3><Link href={`/projects/${project.id}`}>{project.title}</Link></h3>
      <p>{project.summary}</p>
      <div className="tag-list" aria-label={`${project.title} tools and themes`}>
        {project.tags.slice(0, 5).map((tag) => <span className="tag" key={tag}>{tag}</span>)}
      </div>
      <div className="project-card-actions">
        <Link className="text-link" href={`/projects/${project.id}`}>View project <span aria-hidden="true">→</span></Link>
        {project.links.map((link) => (
          <TrackedLink
            key={link.url}
            href={link.url}
            event="project_source_clicked"
            properties={{ slug: project.id, source: link.label }}
            target="_blank"
            rel="noreferrer"
            className="text-link muted-link"
          >
            {link.label} <span aria-hidden="true">↗</span>
          </TrackedLink>
        ))}
      </div>
    </article>
  );
}
