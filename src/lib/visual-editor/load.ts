import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { pageDraftSchema } from '@/lib/cms/schemas';
import { parseVisualPageDocument } from './schema';

export async function loadVisualPageDocument(slug: string, preview = false) {
  if (getEnv().PUBLIC_CONTENT_MODE !== 'database') return null;
  const page = await prisma.cmsPage.findUnique({
    where: { slug },
    include: {
      blocks: preview ? { orderBy: { sortOrder: 'asc' } } : false,
      revisions: preview ? false : { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 }
    }
  });
  if (!page) return null;
  const blocks = preview
    ? ('blocks' in page ? page.blocks : [])
    : (() => {
        const revision = 'revisions' in page ? page.revisions[0] : undefined;
        const snapshot = revision ? pageDraftSchema.safeParse(revision.snapshot) : null;
        return snapshot?.success ? snapshot.data.blocks : [];
      })();
  const visual = blocks.find((candidate) => candidate.kind === 'visual-layout' && candidate.visibility === 'PUBLIC');
  return visual ? parseVisualPageDocument(visual.data) : null;
}
