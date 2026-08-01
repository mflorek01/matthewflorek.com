import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const logs = await prisma.auditLog.findMany({ include: { actor: { select: { email: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json({ logs });
}

