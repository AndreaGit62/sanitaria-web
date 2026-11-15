import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoDashboard from '../components/demo-dashboard';
import { authConfigured } from '../lib/supabase/config';
import { createSupabase } from '../lib/supabase/server';
import { fromRow } from '../lib/appointments';
export const dynamic = 'force-dynamic';

export default async function Home({searchParams}: {searchParams:Promise<{notice?:string}>}) {
  if (!authConfigured()) return <><div className="demo-access"><span>La demo è aperta con dati di fantasia.</span><Link href="/login">Scopri l’accesso personale →</Link></div><DemoDashboard/></>;
  const db = await createSupabase();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect('/login');
  const [profile, visits] = await Promise.all([
    db.from('profiles').select('display_name').eq('id',user.id).maybeSingle(),
    db.from('appointments').select('*',{count:'exact'}).eq('user_id',user.id).order('date',{ascending:false}).order('id').limit(500),
  ]);
  const name = profile.data?.display_name || String(user.user_metadata.name || 'Benvenuto');
  const {notice} = await searchParams;
  const loadError = visits.error
    ? ['PGRST205','42P01'].includes(visits.error.code)
      ? 'Archivio appuntamenti da attivare: esegui la configurazione dello step 3 in Supabase, poi aggiorna la pagina.'
      : 'Non è stato possibile caricare gli appuntamenti. Aggiorna la pagina prima di effettuare modifiche.'
    : '';
  return <DemoDashboard key={user.id} personal initialData={(visits.data ?? []).map(fromRow)} displayName={name} initialError={loadError || (notice==='logout-error'?'Uscita non riuscita. Riprova tra poco.':'')} truncated={(visits.count ?? 0)>500}/>;
}
