import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { listPages, listProjects } from '@/lib/cms';

export default async function AdminHomePage() {
  const user = await getAuthenticatedAdmin();
  if (!user) redirect('/admin/login');
  const [pages, projects] = await Promise.all([listPages(), listProjects()]);
  return <><div className="admin-heading"><div><p className="admin-kicker">Authenticated editor</p><h1>Content workspace</h1><p>Changes stay in draft until you explicitly publish them.</p></div></div><section className="admin-grid"><div className="admin-card"><div className="admin-card-heading"><h2>Pages</h2></div>{pages.length ? <ul className="admin-list">{pages.map((page) => <li key={page.id}><Link href={`/admin/pages/${page.id}`}><strong>{page.title}</strong><span>{page.isPublished ? 'Published' : 'Draft'} · {page.blocks.length} blocks</span></Link></li>)}</ul> : <p>No pages yet.</p>}</div><div className="admin-card"><div className="admin-card-heading"><h2>Projects</h2><span>{projects.length}</span></div><ul className="admin-list">{projects.map((project) => <li key={project.id}><Link href={`/admin/projects/${project.id}`}><strong>{project.title}</strong><span>{project.category.name} · {project.publicationStatus === 'PUBLIC' ? 'Published' : 'Draft'}</span></Link></li>)}</ul></div></section></>;
}
