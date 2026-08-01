import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES, parseMetamorphysisExport, parseMetamorphysisJson } from '../src/lib/integrations/metamorphysis/schema';

const project = { id: 'ops-1', title: 'Operations grant database', summary: 'A bounded summary', category: 'WORK' as const, tags: ['automation'], links: [{ label: 'Repository', url: 'https://github.com/example/ops' }] };

describe('Metamorphysis export schema', () => {
  it('accepts the narrow export shape and applies safe defaults', () => {
    expect(parseMetamorphysisExport({ sourceVersion: 'v1', projects: [project] }).projects[0]).toMatchObject({ category: 'WORK', tags: ['automation'] });
  });

  it('rejects unknown fields, duplicate IDs, and unsafe links', () => {
    expect(() => parseMetamorphysisExport({ sourceVersion: 'v1', projects: [{ ...project, unexpected: 'secret' }] })).toThrow();
    expect(() => parseMetamorphysisExport({ sourceVersion: 'v1', projects: [project, project] })).toThrow(/Duplicate project id/);
    expect(() => parseMetamorphysisExport({ sourceVersion: 'v1', projects: [{ ...project, links: [{ label: 'bad', url: 'javascript:alert(1)' }] }] })).toThrow();
  });

  it('rejects oversized manual JSON before parsing', () => {
    expect(() => parseMetamorphysisJson(JSON.stringify({ sourceVersion: 'v1', projects: [], padding: 'x'.repeat(MAX_IMPORT_BYTES) }))).toThrow(/1 MB/);
  });
});
