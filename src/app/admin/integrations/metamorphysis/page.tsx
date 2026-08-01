import { redirect } from 'next/navigation';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { MetamorphysisSyncPanel } from './MetamorphysisSyncPanel';

export const metadata = { title: 'Metamorphysis sync' };
export const dynamic = 'force-dynamic';

export default async function MetamorphysisSyncPage() {
  const user = await getAuthenticatedAdmin();
  if (!user) redirect('/admin/login?next=/admin/integrations/metamorphysis');
  return <main className="site-shell"><MetamorphysisSyncPanel /></main>;
}
