import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoDashboard from '../components/demo-dashboard';
import { authConfigured } from '../lib/supabase/config';
import { createSupabase } from '../lib/supabase/server';
import { fromRow, validId } from '../lib/appointments';
import { documentFromRow } from '../lib/documents';
export const dynamic = 'force-dynamic';

export default async function Home({searchParams}: {searchParams:Promise<{notice?:string;appointment?:string}>}) {
  if (!authConfigured()) return <><div className="demo-access"><span>La demo è aperta con dati di fantasia.</span><Link href="/login">Scopri l’accesso personale →</Link></div><DemoDashboard/></>;
  const params=await searchParams;
  const requestedAppointment=validId(params.appointment)?params.appointment:undefined;
  const db = await createSupabase();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect(requestedAppointment?`/login?appointment=${requestedAppointment}`:'/login');
  const [profile, visits, documents] = await Promise.all([
    db.from('profiles').select('display_name').eq('id',user.id).maybeSingle(),
    db.from('appointments').select('*',{count:'exact'}).eq('user_id',user.id).order('date',{ascending:false,nullsFirst:true}).order('id').limit(500),
    db.from('documents').select('*, appointment:appointments(title,date)',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).order('id').limit(500),
  ]);
  const name = profile.data?.display_name || String(user.user_metadata.name || 'Benvenuto');
  const {notice} = await searchParams;
  const loadError = visits.error
    ? ['PGRST205','42P01'].includes(visits.error.code)
      ? 'Archivio appuntamenti da attivare: esegui la configurazione dello step 3 in Supabase, poi aggiorna la pagina.'
      : 'Non è stato possibile caricare gli appuntamenti. Aggiorna la pagina prima di effettuare modifiche.'
    : '';
  const documentError=documents.error
    ? ['PGRST205','42P01','PGRST200'].includes(documents.error.code)
      ? 'Archivio documenti da attivare: esegui la configurazione dello step 4 in Supabase, poi aggiorna la pagina.'
      : 'Non è stato possibile caricare l’archivio. Aggiorna la pagina prima di aggiungere file.'
    : '';
  return <DemoDashboard key={user.id} personal openAppointmentId={requestedAppointment} initialData={(visits.data ?? []).map(fromRow)} displayName={name} initialError={loadError || (notice==='logout-error'?'Uscita non riuscita. Riprova tra poco.':'')} truncated={(visits.count ?? 0)>500} initialDocuments={(documents.data ?? []).map(documentFromRow)} documentError={documentError} documentsTruncated={(documents.count ?? 0)>500}/>;
}
