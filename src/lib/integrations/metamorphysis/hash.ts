import { createHash } from 'node:crypto';
import type { MetamorphysisExport } from './schema';

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}

export function canonicalJson(value: unknown): string {
  return canonicalize(value);
}

export function hashMetamorphysisExport(value: MetamorphysisExport): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function deterministicProjectSlug(project: { id: string; slug?: string; title: string }): string {
  const base = (project.slug ?? project.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'project';
  return `${base}-${createHash('sha256').update(project.id).digest('hex').slice(0, 8)}`;
}
