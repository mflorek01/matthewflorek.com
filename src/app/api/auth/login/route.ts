import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { assertSameOrigin, clearLoginAttempts, createAdminSession, normalizedLoginEmail, recordLoginAttempt, sessionCookie, verifyPassword } from '@/lib/auth';

const loginSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await request.json());
    const email = normalizedLoginEmail(input.email);
    const attempt = await recordLoginAttempt(request, email);
    if (attempt.limited) {
      return NextResponse.json({ error: 'Too many sign-in attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': String(attempt.retryAfter) } });
    }
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
      const headers = attempt.backoffSeconds ? { 'Retry-After': String(attempt.backoffSeconds) } : undefined;
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers });
    }
    await clearLoginAttempts(attempt.subjectHash);
    const token = await createAdminSession(user.id, request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Enter a valid email and password' : error instanceof Error ? error.message : 'Unable to sign in';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
