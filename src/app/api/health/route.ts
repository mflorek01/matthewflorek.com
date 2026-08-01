import { NextResponse } from 'next/server';
import { healthQuerySchema } from '@/lib/contracts';
import type { HealthResponse } from '@/lib/contracts';
import { isDatabaseReady } from '@/lib/db';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const url = new URL(request.url);
  const query = healthQuerySchema.safeParse({ db: url.searchParams.get('db') ?? undefined });

  if (!query.success) {
    return NextResponse.json(
      { ok: false, status: 'error', checks: { db: 'fail' } },
      { status: 400, headers }
    );
  }

  const shouldCheckDb = query.data.db === '1' || query.data.db === 'true';

  if (!shouldCheckDb) {
    return NextResponse.json(
      { ok: true, status: 'ok', checks: { db: 'skip' } },
      { status: 200, headers }
    );
  }

  try {
    await isDatabaseReady();
    return NextResponse.json(
      { ok: true, status: 'ok', checks: { db: 'pass' } },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { ok: false, status: 'degraded', checks: { db: 'fail' } },
      { status: 503, headers }
    );
  }
}

export type { HealthResponse };
