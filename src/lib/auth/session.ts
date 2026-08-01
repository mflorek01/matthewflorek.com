import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { ADMIN_SESSION_COOKIE, SESSION_ROTATION_THRESHOLD_SECONDS, SESSION_TTL_SECONDS } from './constants';
import { sessionCookie } from './cookies';
import { createOpaqueToken, hashIp, hashOpaqueToken } from './crypto';

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  name: string | null;
};

function nowPlusSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createAdminSession(adminUserId: string, request?: Request) {
  const token = createOpaqueToken();
  await prisma.adminSession.create({
    data: {
      adminUserId,
      tokenHash: hashOpaqueToken(token),
      expiresAt: nowPlusSeconds(SESSION_TTL_SECONDS),
      ipHash: hashIp(request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request?.headers.get('x-real-ip')),
      userAgent: request?.headers.get('user-agent')?.slice(0, 512) ?? null
    }
  });
  return token;
}

export async function revokeSessionByToken(token: string | null | undefined) {
  if (!token) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: hashOpaqueToken(token) } });
}

async function findSession(token: string | null | undefined) {
  if (!token) return null;
  return prisma.adminSession.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { adminUser: true }
  });
}

export async function getAuthenticatedAdmin(token?: string | null): Promise<AuthenticatedAdmin | null> {
  const cookieStore = await cookies();
  const sessionToken = token ?? cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await findSession(sessionToken);
  if (!session || session.expiresAt <= new Date() || !session.adminUser.isActive) return null;

  await prisma.adminSession.updateMany({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { id: session.adminUser.id, email: session.adminUser.email, name: session.adminUser.name };
}

export async function getSessionForRequest(request: Request) {
  const header = request.headers.get('cookie') ?? '';
  const token = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))?.split('=').slice(1).join('=') ?? null;
  const session = await findSession(token);
  if (!session || session.expiresAt <= new Date() || !session.adminUser.isActive) return null;
  const cookieStore = await cookies();
  const activeSession = session;
  let activeToken = token;
  if (shouldRotateSession(session.expiresAt) && token) {
    const rotatedToken = await rotateSession(session.id, session.adminUserId, token, request);
    if (rotatedToken) {
      activeToken = rotatedToken;
      cookieStore.set(sessionCookie(activeToken));
    }
  }
  await prisma.adminSession.updateMany({ where: { id: activeSession.id }, data: { lastSeenAt: new Date() } });
  return { session: activeSession, user: { id: activeSession.adminUser.id, email: activeSession.adminUser.email, name: activeSession.adminUser.name }, token: activeToken };
}

export async function rotateSession(sessionId: string, adminUserId: string, currentToken: string, request?: Request) {
  const nextToken = createOpaqueToken();
  const result = await prisma.adminSession.updateMany({
    where: { id: sessionId, adminUserId, tokenHash: hashOpaqueToken(currentToken) },
    data: {
      tokenHash: hashOpaqueToken(nextToken),
      expiresAt: nowPlusSeconds(SESSION_TTL_SECONDS),
      lastSeenAt: new Date(),
      ipHash: hashIp(request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request?.headers.get('x-real-ip')),
      userAgent: request?.headers.get('user-agent')?.slice(0, 512) ?? null
    }
  });
  return result.count === 1 ? nextToken : null;
}

export function shouldRotateSession(expiresAt: Date) {
  return expiresAt.getTime() - Date.now() < SESSION_ROTATION_THRESHOLD_SECONDS * 1000;
}

export function getSessionSecret() {
  const secret = getEnv().AUTH_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_SESSION_SECRET is not configured');
  return secret;
}
