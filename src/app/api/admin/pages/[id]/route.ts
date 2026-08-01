import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { getPage, pageDraftSchema, savePageDraft } from '@/lib/cms';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const page = await getPage(id);
  return page ? NextResponse.json({ page }) : NextResponse.json({ error: 'Page not found' }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const draft = pageDraftSchema.parse(await request.json());
    return NextResponse.json({ page: await savePageDraft(id, draft, auth.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save draft' }, { status: 400 });
  }
}

