import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { deleteProjectAsset, listProjectAssets, readProjectAsset, storeProjectAsset, MAX_UPLOAD_BODY_BYTES } from '@/lib/cms';

function assertBodyWithinLimit(request: Request, maximum: number) {
  const value = request.headers.get('content-length');
  if (value !== null && (!/^\d+$/.test(value) || Number(value) > maximum)) throw new Error('Upload body exceeds the allowed size');
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const assetId = new URL(request.url).searchParams.get('assetId');
    if (!assetId) return Response.json({ assets: await listProjectAssets(id) });
    const asset = await readProjectAsset(id, assetId);
    return new Response(asset.bytes, { headers: { 'Content-Type': asset.contentType, 'Content-Disposition': `inline; filename="${asset.asset.id}"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to read asset' }, { status: 404 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    assertBodyWithinLimit(request, MAX_UPLOAD_BODY_BYTES);
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    const asset = await storeProjectAsset(id, file, auth.user.id, typeof form.get('altText') === 'string' ? form.get('altText') as string : undefined);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to upload asset' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const { id } = await context.params;
    const body = await request.json() as { assetId?: unknown };
    if (typeof body.assetId !== 'string' || !body.assetId) return Response.json({ error: 'assetId is required' }, { status: 400 });
    await deleteProjectAsset(id, body.assetId, auth.user.id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to delete asset' }, { status: 400 });
  }
}
