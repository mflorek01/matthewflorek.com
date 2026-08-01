import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { restorePageRevision } from '@/lib/cms';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const body = await request.json() as { revisionId?: string };
    if (!body.revisionId) return NextResponse.json({ error: 'revisionId is required' }, { status: 400 });
    return NextResponse.json({ page: await restorePageRevision(id, body.revisionId, auth.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to restore revision' }, { status: 400 });
  }
}

