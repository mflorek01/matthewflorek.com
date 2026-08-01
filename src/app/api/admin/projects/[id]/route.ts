import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { getProject, projectDraftSchema, saveProjectDraft } from '@/lib/cms';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const project = await getProject(id);
  return project ? NextResponse.json({ project }) : NextResponse.json({ error: 'Project not found' }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return NextResponse.json({ project: await saveProjectDraft(id, projectDraftSchema.parse(await request.json()), auth.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save draft' }, { status: 400 });
  }
}

