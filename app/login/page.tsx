import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../components/auth-shell';
import AuthForm from '../../components/auth-form';
import { authConfigured, emailSignupEnabled } from '../../lib/supabase/config';
import { createSupabase } from '../../lib/supabase/server';
export const dynamic = 'force-dynamic';

export default async function LoginPage({searchParams}: {searchParams:Promise<{mode?:string;notice?:string}>}) {
  const {mode, notice} = await searchParams;
  const active = mode === 'register' && emailSignupEnabled() ? 'register' : 'login';
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
    {notice === 'invalid-link' && <p className="auth-alert error" role="alert">Link non valido o non disponibile. Accedi con un account già abilitato.</p>}
    {(mode === 'recover' || (mode === 'register' && !emailSignupEnabled())) && <p className="auth-alert setup" role="status">Registrazione e recupero via email sono rimandati. Puoi accedere con un account già abilitato.</p>}
    <AuthForm key={active} mode={active} disabled={!configured}/>
    <div className="auth-links">{active === 'register' ? <Link href="/login">Hai già un account? Accedi</Link> : emailSignupEnabled() ? <span>Non hai un account? <Link href="/login?mode=register">Registrati</Link></span> : <span>Accesso riservato agli utenti abilitati.</span>}</div>
    <Link className="auth-demo-link" href="/demo">Esplora la demo con dati inventati →</Link>
  </AuthShell>;
}
