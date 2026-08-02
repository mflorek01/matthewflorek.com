import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, requireAdmin } from '@/lib/auth';
import { auditAiCredentialTest, getAiSettingsStatus, getRuntimeAiCredentials, removeAiSettings, saveAiSettings, testAiCredential } from '@/lib/ai/settings';

const testSchema = z.object({ action: z.literal('test'), apiKey: z.string().trim().min(10).max(500).optional() }).strict();
const invalid = () => NextResponse.json({ error: 'Invalid AI settings.' }, { status: 400 });

export async function GET(request: Request) {
  const auth = await requireAdmin(request); if (auth.response) return auth.response;
  return NextResponse.json(await getAiSettingsStatus());
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request); if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const parsed = testSchema.safeParse(await request.json());
    if (!parsed.success) return invalid();
    const credentials = await getRuntimeAiCredentials();
    await testAiCredential(parsed.data.apiKey ?? credentials.apiKey ?? '');
    await auditAiCredentialTest(auth.user.id);
    return NextResponse.json({ ...(await getAiSettingsStatus()), tested: true });
  } catch { return NextResponse.json({ error: 'The credential could not be verified or settings could not be saved.' }, { status: 400 }); }
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request); if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const parsed = z.object({ apiKey: z.string().trim().min(10).max(500).optional(), model: z.string().trim().min(1).max(100).optional() }).strict().safeParse(await request.json());
    if (!parsed.success || (parsed.data.apiKey === undefined && parsed.data.model === undefined)) return invalid();
    const credentials = await getRuntimeAiCredentials();
    await testAiCredential(parsed.data.apiKey ?? credentials.apiKey ?? '');
    await saveAiSettings({ ...parsed.data, actorId: auth.user.id });
    return NextResponse.json(await getAiSettingsStatus());
  } catch { return NextResponse.json({ error: 'The credential could not be verified or settings could not be saved.' }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request); if (auth.response) return auth.response;
  try {
    assertSameOrigin(request);
    const parsed = z.object({ enabled: z.boolean() }).strict().safeParse(await request.json());
    if (!parsed.success) return invalid();
    await saveAiSettings({ enabled: parsed.data.enabled, actorId: auth.user.id });
    return NextResponse.json(await getAiSettingsStatus());
  } catch { return NextResponse.json({ error: 'Settings could not be updated.' }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request); if (auth.response) return auth.response;
  try { assertSameOrigin(request); await removeAiSettings(auth.user.id); return NextResponse.json(await getAiSettingsStatus()); }
  catch { return NextResponse.json({ error: 'Settings could not be removed.' }, { status: 400 }); }
}
