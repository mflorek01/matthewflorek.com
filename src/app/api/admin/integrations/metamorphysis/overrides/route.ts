import { NextResponse } from 'next/server';
import { assertMetamorphysisAdmin, MetamorphysisAdminRateLimitError } from '@/lib/integrations/metamorphysis/admin';
import { saveMetamorphysisOverrides } from '@/lib/integrations/metamorphysis/service';
import { MAX_SMALL_ADMIN_JSON_BYTES, readBoundedJson, redactSyncError } from '@/lib/integrations/metamorphysis/security';
import { metamorphysisOverridesRequestSchema } from '@/lib/integrations/metamorphysis/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertMetamorphysisAdmin(request);
    const body = metamorphysisOverridesRequestSchema.parse(await readBoundedJson(request, MAX_SMALL_ADMIN_JSON_BYTES));
    return NextResponse.json(await saveMetamorphysisOverrides(body.projectId, body.fields));
  } catch (error) {
    if (error instanceof MetamorphysisAdminRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    const message = redactSyncError(error);
    return NextResponse.json({ error: message }, { status: message.includes('authentication') ? 401 : 400 });
  }
}
