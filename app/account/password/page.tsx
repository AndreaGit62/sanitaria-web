import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '../../../components/auth-shell';
import AuthForm from '../../../components/auth-form';
import { authConfigured } from '../../../lib/supabase/config';
import { createSupabase } from '../../../lib/supabase/server';
export const dynamic = 'force-dynamic';
export default async function PasswordPage() {
  if (!authConfigured()) redirect('/login');
  const supabase = await createSupabase();
  const {data:{user},error} = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  return <AuthShell title="Una nuova password." description="Dopo il salvataggio dovrai accedere di nuovo. Le altre sessioni verranno revocate."><AuthForm mode="password"/><Link className="auth-demo-link" href="/">Torna al tuo spazio →</Link></AuthShell>;
}
