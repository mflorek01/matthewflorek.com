import { NextResponse } from 'next/server';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { MAX_RESUME_BYTES, storeResume } from '@/lib/storage/portfolio-files';

function assertBodyWithinLimit(request: Request) {
  const value = request.headers.get('content-length');
  if (value !== null && (!/^\d+$/.test(value) || Number(value) > MAX_RESUME_BYTES + 128 * 1024)) throw new Error('Upload body exceeds the allowed size');
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    assertBodyWithinLimit(request);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 });
    const asset = await storeResume(file);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to upload resume' }, { status: 400 });
  }
}
