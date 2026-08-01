import { NextResponse } from 'next/server';
import { assertMetamorphysisAdmin, MetamorphysisAdminRateLimitError } from '@/lib/integrations/metamorphysis/admin';
import { fetchMetamorphysisExport } from '@/lib/integrations/metamorphysis/client';
import { MAX_ADMIN_JSON_BYTES, readBoundedJson, redactSyncError } from '@/lib/integrations/metamorphysis/security';
import { metamorphysisImportRequestSchema, parseMetamorphysisJson } from '@/lib/integrations/metamorphysis/schema';
import { getMetamorphysisSyncOverview, syncMetamorphysisExport } from '@/lib/integrations/metamorphysis/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    assertMetamorphysisAdmin(request);
    return NextResponse.json(await getMetamorphysisSyncOverview(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MetamorphysisAdminRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    return NextResponse.json({ error: redactSyncError(error) }, { status: error instanceof Error && error.message.includes('authentication') ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertMetamorphysisAdmin(request);
    const body = metamorphysisImportRequestSchema.parse(await readBoundedJson(request, MAX_ADMIN_JSON_BYTES));
    const payload = body.mode === 'remote' ? await fetchMetamorphysisExport() : parseMetamorphysisJson(body.json ?? JSON.stringify(body.payload));
    return NextResponse.json(await syncMetamorphysisExport(payload), { status: 200 });
  } catch (error) {
    if (error instanceof MetamorphysisAdminRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    const message = redactSyncError(error);
    return NextResponse.json({ error: message }, { status: message.includes('authentication') ? 401 : 400 });
  }
}
