import { notFound, redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { getPage } from '@/lib/cms';
import { PageEditor } from '@/components/admin/PageEditor';

export default async function AdminPageEditor({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedAdmin();
  if (!user) redirect('/admin/login');
  const page = await getPage((await params).id);
  if (!page) notFound();
  return <PageEditor page={page} />;
}

