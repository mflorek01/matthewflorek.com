'use client';

import { useMemo, useState } from 'react';
import { trackAnalyticsEvent } from '@/lib/analytics/client';
import type { PublicPortfolioProject } from '@/lib/content/portfolio';
import { ProjectCard } from './ProjectCard';

export function ProjectExplorer({ projects, emptyTitle, emptyCopy }: { projects: PublicPortfolioProject[]; emptyTitle: string; emptyCopy: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const filters = useMemo(() => ['all', ...Array.from(new Set(projects.flatMap((project) => project.tags))).sort()], [projects]);
  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesFilter = filter === 'all' || project.tags.includes(filter);
      const haystack = [project.title, project.summary, ...project.tags].join(' ').toLowerCase();
      return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [filter, projects, query]);

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim()) trackAnalyticsEvent('portfolio_search_used', { content_type: 'projects' });
  }

  function updateFilter(value: string) {
    setFilter(value);
    if (value !== 'all') trackAnalyticsEvent('project_filter_used', { filter: value });
  }

  return (
    <div className="explorer">
      <div className="explorer-controls">
        <label className="search-field">
          <span>Search projects</span>
          <input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search by project or skill" type="search" />
        </label>
        <label className="filter-field">
          <span>Filter by theme</span>
          <select value={filter} onChange={(event) => updateFilter(event.target.value)}>
            {filters.map((option) => <option value={option} key={option}>{option === 'all' ? 'All themes' : option}</option>)}
          </select>
        </label>
      </div>
      {projects.length === 0 ? (
        <div className="empty-state">
          <h3>{emptyTitle}</h3>
          <p>{emptyCopy}</p>
        </div>
      ) : visibleProjects.length === 0 ? (
        <div className="empty-state compact"><h3>No matching projects</h3><p>Try a different search or theme.</p></div>
      ) : (
        <div className="project-grid" aria-live="polite">
          {visibleProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </div>
  );
}
