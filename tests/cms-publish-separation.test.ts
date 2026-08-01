import { describe, expect, it, vi } from 'vitest';
import { publishPage, publishProject } from '@/lib/cms';
import { pageDraftSchema, projectDraftSchema, selectPublishedSnapshot } from '@/lib/cms';

describe('CMS publication separation', () => {
  it('only selects published revisions for public reads', () => {
    const draft = { status: 'DRAFT', snapshot: { title: 'Unpublished copy' } };
    const published = { status: 'PUBLISHED', snapshot: { title: 'Approved copy' } };
    expect(selectPublishedSnapshot([draft])).toBeNull();
    expect(selectPublishedSnapshot([draft, published])).toEqual({ title: 'Approved copy' });
  });

  it('requires explicit draft shapes for pages and projects', () => {
    expect(pageDraftSchema.parse({ title: 'Overview', blocks: [] }).title).toBe('Overview');
    expect(projectDraftSchema.safeParse({ title: 'Bad' }).success).toBe(false);
  });

  it('refuses CMS publication while public content is static', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PUBLIC_CONTENT_MODE', 'static');
    await expect(publishProject('project-id', 'admin-id')).rejects.toThrow(/PUBLIC_CONTENT_MODE=static/);
    await expect(publishPage('page-id', 'admin-id')).rejects.toThrow(/PUBLIC_CONTENT_MODE=static/);
    vi.unstubAllEnvs();
  });
});
