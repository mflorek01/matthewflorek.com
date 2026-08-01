import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, assertSameOrigin, expiredSessionCookie, revokeSessionByToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))?.split('=').slice(1).join('=');
    await revokeSessionByToken(token);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(expiredSessionCookie());
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to sign out' }, { status: 400 });
  }
}

