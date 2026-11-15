import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import AuthForm from '../../components/auth-form';
import BrandLogo from '../../components/brand-logo';
import { authConfigured } from '../../lib/supabase/config';
import { createSupabase } from '../../lib/supabase/server';
import { logout } from '../auth/actions';
export const dynamic = 'force-dynamic';
export default async function AccountPage() {
  if (!authConfigured()) redirect('/login');
  const db = await createSupabase();
  const {data:{user},error} = await db.auth.getUser();
  if (error || !user) redirect('/login');
  const {data:profile,error:profileError} = await db.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  return <div className="personal-shell"><header className="personal-header"><Link href="/" className="brand"><BrandLogo/></Link><form action={logout}><button className="button subtle"><LogOut size={17}/> Esci</button></form></header><main className="personal-main"><span className="auth-kicker">IL TUO ACCOUNT</span><h1>Il tuo profilo</h1><p>{user.email}</p><section className="panel personal-profile" style={{maxWidth:500,marginTop:25}}>{profileError&&<p className="auth-alert setup">Completa la configurazione della tabella profili per salvare il nome.</p>}<AuthForm mode="profile" name={profile?.display_name || String(user.user_metadata.name || '')}/><Link className="auth-demo-link" href="/account/password">Cambia la password →</Link><Link className="auth-demo-link" href="/">Torna all’agenda →</Link></section></main></div>;
}
