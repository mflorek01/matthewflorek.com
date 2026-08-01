import { redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { getEnv } from '@/lib/env';

export async function resolvePreview(searchParams: Promise<Record<string, string | string[] | undefined>> | undefined, path: string) {
  const params = searchParams ? await searchParams : {};
  const requested = params.preview === '1' || (Array.isArray(params.preview) && params.preview.includes('1'));
  if (!requested || getEnv().PUBLIC_CONTENT_MODE !== 'database') return false;
  if (!(await getAuthenticatedAdmin())) redirect(`/admin/login?next=${encodeURIComponent(path)}`);
  return true;
}
