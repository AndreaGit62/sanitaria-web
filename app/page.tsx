import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarDays, FolderOpen, ShieldCheck, Plus, LogOut } from 'lucide-react';
import DemoDashboard from '../components/demo-dashboard';
import AuthForm from '../components/auth-form';
import { authConfigured } from '../lib/supabase/config';
import { createSupabase } from '../lib/supabase/server';
import { logout } from './auth/actions';
export const dynamic = 'force-dynamic';

export default async function Home({searchParams}: {searchParams:Promise<{notice?:string}>}) {
  if (!authConfigured()) return <><div className="demo-access"><span>La demo è aperta con dati di fantasia.</span><Link href="/login">Scopri l’accesso personale →</Link></div><DemoDashboard/></>;
  const supabase = await createSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  const name = profile?.display_name || String(user.user_metadata.name || 'Benvenuto');
  const {notice} = await searchParams;
  return <div className="personal-shell"><header className="personal-header"><Link href="/" className="brand"><span className="brand-icon"><Plus size={24}/></span>cura.</Link><form action={logout}><button className="button subtle"><LogOut size={17}/> Esci</button></form></header><main className="personal-main"><span className="auth-kicker">IL TUO SPAZIO PERSONALE</span><h1>Ciao, {name}.</h1><p>Il tuo account è attivo. Iniziamo da qui.</p>{notice==='logout-error'&&<p className="auth-alert error" role="alert">Uscita non riuscita. Riprova tra poco.</p>}<div className="personal-status"><ShieldCheck size={24}/><div><strong>Accesso personale attivo</strong><p>{user.email}</p></div></div><div className="personal-grid"><section className="panel personal-profile"><h2>Il tuo profilo</h2><p>Come vuoi essere chiamato nell’app?</p>{profileError&&<p className="auth-alert setup">Completa la configurazione del database per salvare il nome.</p>}<AuthForm mode="profile" name={name}/><Link href="/account/password" className="auth-demo-link">Cambia la password →</Link></section><section className="panel personal-next"><CalendarDays size={28}/><h2>La tua agenda personale</h2><p>Nel prossimo step colleghiamo appuntamenti e calendario al tuo account, con dati separati per ogni utente.</p><FolderOpen size={28}/><h2>Il tuo archivio privato</h2><p>I documenti personali verranno collegati nello step dedicato. La demo rimane uno spazio distinto.</p><Link href="/demo" className="button subtle">Apri la demo grafica →</Link></section></div><p className="auth-bottom">Step 02 · Profilo e accesso · Appuntamenti e documenti remoti non ancora attivi</p></main></div>;
}
