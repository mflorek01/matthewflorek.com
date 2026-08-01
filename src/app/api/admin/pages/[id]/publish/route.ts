import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { publishPage } from '@/lib/cms';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    return NextResponse.json({ page: await publishPage(id, auth.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to publish page' }, { status: 400 });
  }
}

