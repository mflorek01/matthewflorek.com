import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { listPages, pageDraftSchema } from '@/lib/cms';
import { prisma } from '@/lib/db';

function publicPage(page: Awaited<ReturnType<typeof listPages>>[number]) {
  return { ...page, revisions: page.revisions.map((revision) => ({ id: revision.id, version: revision.version, status: revision.status, createdAt: revision.createdAt })) };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ pages: (await listPages()).map(publicPage) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const input = pageDraftSchema.parse(await request.json());
    const page = await prisma.cmsPage.create({ data: { slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || `page-${Date.now()}`, title: input.title } });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create page' }, { status: 400 });
  }
}
