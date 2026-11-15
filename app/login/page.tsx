import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/auth-shell';
import AuthForm from '../../components/auth-form';
import { authConfigured } from '../../lib/supabase/config';
import { createSupabase } from '../../lib/supabase/server';
export const dynamic = 'force-dynamic';

export default async function LoginPage({searchParams}: {searchParams:Promise<{mode?:string;notice?:string}>}) {
  const {mode, notice} = await searchParams;
  const active = mode === 'register' ? 'register' : mode === 'recover' ? 'recover' : 'login';
  const configured = authConfigured();
  if (configured) {
    const supabase = await createSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/');
  }
  const titles = {login:'Bentornato.',register:'Il tuo spazio, da oggi.',recover:'Ritroviamo il tuo accesso.'};
  const descriptions = {login:'Accedi con la tua email per entrare nel tuo spazio personale.',register:'Crea un account personale e conferma la tua email.',recover:'Ti invieremo un link per scegliere una nuova password.'};
  return <AuthShell title={titles[active]} description={descriptions[active]}>
    {!configured && <div className="auth-alert setup" role="status"><strong>Collegamento a Supabase da completare</strong><p>Questa è l’anteprima delle schermate. Registrazione e accesso saranno attivi dopo la configurazione del progetto.</p></div>}
    {notice === 'confirmed' && <p className="auth-alert success" role="status">Email confermata. Ora puoi accedere.</p>}
    {notice === 'password-updated' && <p className="auth-alert success" role="status">Password aggiornata. Accedi con la nuova password.</p>}
    {notice === 'invalid-link' && <p className="auth-alert error" role="alert">Link non valido o scaduto. Richiedi un nuovo link di recupero o ripeti la registrazione.</p>}
    <AuthForm key={active} mode={active} disabled={!configured}/>
    <div className="auth-links">{active === 'login' ? <><Link href="/login?mode=recover">Hai dimenticato la password?</Link><span>Non hai un account? <Link href="/login?mode=register">Registrati</Link></span></> : <Link href="/login">Hai già un account? Accedi</Link>}</div>
    <Link className="auth-demo-link" href="/demo">Esplora la demo con dati inventati →</Link>
  </AuthShell>;
}
