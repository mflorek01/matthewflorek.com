import { NextResponse } from 'next/server';
import { getSessionForRequest } from './session';

export async function requireAdmin(request: Request) {
  const authenticated = await getSessionForRequest(request);
  if (!authenticated) {
    return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) } as const;
  }
  return { ...authenticated, response: null } as const;
}

export function adminError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request could not be completed';
  return NextResponse.json({ error: message }, { status: 400 });
}

