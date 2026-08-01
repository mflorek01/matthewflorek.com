import { canonicalJson } from './hash';
import type { MetamorphysisProject } from './schema';

export const SYNC_FIELDS = ['title', 'summary', 'category', 'tags', 'links', 'details'] as const;
export type SyncField = typeof SYNC_FIELDS[number];

export type FieldChange = {
  field: SyncField;
  before: unknown;
  after: unknown;
};

export type OverrideMap = Partial<Record<SyncField, unknown>>;

export type SyncDiff = {
  changes: FieldChange[];
  conflicts: Array<FieldChange & { override: unknown }>;
  effective: MetamorphysisProject;
  reviewRequired: boolean;
};

export function diffProject(previous: MetamorphysisProject | null, next: MetamorphysisProject, overrides: OverrideMap = {}): SyncDiff {
  const changes: FieldChange[] = [];
  const conflicts: Array<FieldChange & { override: unknown }> = [];
  const effective = { ...next };

  for (const field of SYNC_FIELDS) {
    const before = previous?.[field];
    const after = next[field];
    if (previous && canonicalJson(before) !== canonicalJson(after)) {
      const change = { field, before, after };
      changes.push(change);
      if (Object.prototype.hasOwnProperty.call(overrides, field)) {
        conflicts.push({ ...change, override: overrides[field] });
      }
    }
    if (Object.prototype.hasOwnProperty.call(overrides, field)) {
      (effective as Record<string, unknown>)[field] = overrides[field];
    }
  }

  return { changes, conflicts, effective, reviewRequired: changes.length > 0 || conflicts.length > 0 };
}

export function summarizeDiffs(diffs: Array<{ externalProjectId: string; diff: SyncDiff }>) {
  return {
    changedProjects: diffs.filter(({ diff }) => diff.changes.length > 0).map(({ externalProjectId, diff }) => ({
      externalProjectId,
      fields: diff.changes.map((change) => change.field)
    })),
    conflicts: diffs.flatMap(({ externalProjectId, diff }) => diff.conflicts.map((conflict) => ({
      externalProjectId,
      field: conflict.field
    }))),
    reviewRequired: diffs.some(({ diff }) => diff.reviewRequired)
  };
}
