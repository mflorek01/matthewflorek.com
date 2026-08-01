import { describe, expect, it } from 'vitest';
import { diffProject, summarizeDiffs } from '../src/lib/integrations/metamorphysis/diff';
import type { MetamorphysisProject } from '../src/lib/integrations/metamorphysis/schema';

const previous: MetamorphysisProject = { id: 'p1', title: 'Old title', summary: 'Old summary', category: 'WORK', tags: [], links: [], details: { owner: 'Matthew' } };
const next: MetamorphysisProject = { ...previous, title: 'New title', summary: 'New summary', details: { owner: 'Matthew', status: 'active' } };

describe('Metamorphysis field diffs', () => {
  it('preserves an overridden field while reporting the source conflict', () => {
    const result = diffProject(previous, next, { title: 'My local title' });
    expect(result.effective.title).toBe('My local title');
    expect(result.changes.map((change) => change.field)).toEqual(['title', 'summary', 'details']);
    expect(result.conflicts.map((conflict) => conflict.field)).toEqual(['title']);
    expect(result.reviewRequired).toBe(true);
  });

  it('is deterministic for equivalent nested objects', () => {
    const reordered = { ...next, details: { status: 'active', owner: 'Matthew' } };
    expect(diffProject(next, reordered).changes).toEqual([]);
  });

  it('summarizes only changed projects and conflicts', () => {
    const summary = summarizeDiffs([{ externalProjectId: 'p1', diff: diffProject(previous, next, { title: 'Local' }) }]);
    expect(summary.changedProjects).toEqual([{ externalProjectId: 'p1', fields: ['title', 'summary', 'details'] }]);
    expect(summary.conflicts).toEqual([{ externalProjectId: 'p1', field: 'title' }]);
  });
});
