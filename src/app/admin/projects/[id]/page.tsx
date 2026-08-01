import { notFound, redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { getProject, listCategories } from '@/lib/cms';
import { ProjectEditor } from '@/components/admin/ProjectEditor';

export default async function AdminProjectEditor({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedAdmin();
  if (!user) redirect('/admin/login');
  const project = await getProject((await params).id);
  if (!project) notFound();
  return <ProjectEditor project={project} categories={await listCategories()} />;
}

