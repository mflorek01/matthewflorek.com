import { NextResponse } from 'next/server';
import { AiKnowledgeStatus } from '@prisma/client';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { listKnowledgeDocuments, MAX_KNOWLEDGE_BYTES, storeKnowledgeDocument, updateKnowledgeDocument } from '@/lib/ai/knowledge-admin';

function assertBodyWithinLimit(request: Request) {
  const value = request.headers.get('content-length');
  if (value !== null && (!/^\d+$/.test(value) || Number(value) > MAX_KNOWLEDGE_BYTES + 128 * 1024)) throw new Error('Upload body exceeds the allowed size');
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  return NextResponse.json({ documents: await listKnowledgeDocuments() });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    assertBodyWithinLimit(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A text document is required' }, { status: 400 });
    const title = typeof form.get('title') === 'string' ? form.get('title') as string : undefined;
    return NextResponse.json({ document: await storeKnowledgeDocument(file, title, auth.user.id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to upload knowledge document' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const body = await request.json() as { id?: unknown; title?: unknown; status?: unknown; includeInAi?: unknown };
    if (typeof body.id !== 'string' || !body.id) return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
    const status = body.status === undefined ? undefined : body.status;
    if (status !== undefined && !Object.values(AiKnowledgeStatus).includes(status as AiKnowledgeStatus)) return NextResponse.json({ error: 'Invalid document status' }, { status: 400 });
    if (body.title !== undefined && typeof body.title !== 'string') return NextResponse.json({ error: 'Invalid document title' }, { status: 400 });
    if (body.includeInAi !== undefined && typeof body.includeInAi !== 'boolean') return NextResponse.json({ error: 'Invalid AI inclusion setting' }, { status: 400 });
    const title = typeof body.title === 'string' ? body.title : undefined;
    const includeInAi = typeof body.includeInAi === 'boolean' ? body.includeInAi : undefined;
    const validStatus = status === undefined ? undefined : status as AiKnowledgeStatus;
    return NextResponse.json({ document: await updateKnowledgeDocument(body.id, { title, status: validStatus, includeInAi }, auth.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update knowledge document' }, { status: 400 });
  }
}
