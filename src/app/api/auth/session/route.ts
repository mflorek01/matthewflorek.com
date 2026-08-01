import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/auth';

export async function GET() {
  const user = await getAuthenticatedAdmin();
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}

