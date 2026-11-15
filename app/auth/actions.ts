'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabase } from '../../lib/supabase/server';
import { authConfigured, siteUrl, emailSignupEnabled } from '../../lib/supabase/config';

export type AuthState = { error?: string; message?: string };
const unavailable = { error: 'Accesso non ancora attivo. Completa il collegamento a Supabase.' };
const text = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
const emailValid = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const passwordValid = (s: string) => s.length >= 12 && s.length <= 128;

export async function login(_: AuthState, f: FormData): Promise<AuthState> {
  if (!authConfigured()) return unavailable;
  const email = text(f, 'email'), password = String(f.get('password') ?? '');
  if (!emailValid(email) || !password) return { error: 'Inserisci email e password.' };
  try {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Accesso non riuscito. Controlla le credenziali e la conferma dell’email.' };
  } catch { return { error: 'Servizio non raggiungibile. Riprova tra poco.' }; }
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function register(_: AuthState, f: FormData): Promise<AuthState> {
  if (!emailSignupEnabled()) return {error:'Registrazione via email non ancora disponibile. Usa un account già abilitato.'};
  if (!authConfigured()) return unavailable;
  const email = text(f, 'email'), name = text(f, 'name'), password = String(f.get('password') ?? '');
  if (!emailValid(email) || !name || name.length > 80) return { error: 'Inserisci il tuo nome (massimo 80 caratteri) e un’email valida.' };
  if (!passwordValid(password)) return { error: 'Scegli una password tra 12 e 128 caratteri.' };
  if (password !== f.get('confirm')) return { error: 'Le password non coincidono.' };
  try {
    const supabase = await createSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${siteUrl()}/auth/confirm` } });
    if (error) return { error: 'Registrazione non riuscita. Riprova più tardi.' };
    if (data.session) await supabase.auth.signOut({ scope: 'local' });
    return { message: 'Richiesta ricevuta. Controlla la posta e conferma l’email prima di accedere. Se hai già un account, usa Accedi.' };
  } catch { return { error: 'Registrazione non disponibile. Verifica la configurazione del servizio.' }; }
}

export async function changePassword(_: AuthState, f: FormData): Promise<AuthState> {
  if (!authConfigured()) return unavailable;
  const password = String(f.get('password') ?? '');
  if (!passwordValid(password)) return { error: 'Scegli una password tra 12 e 128 caratteri.' };
  if (password !== f.get('confirm')) return { error: 'Le password non coincidono.' };
  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Sessione scaduta. Accedi di nuovo.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: 'Password non aggiornata. Scegline una diversa o accedi di nuovo.' };
    const {error: signOutError} = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) return {error:'Password aggiornata, ma uscita dalle altre sessioni non riuscita. Riprova a uscire.'};
  } catch { return { error: 'Servizio non raggiungibile. Riprova tra poco.' }; }
  revalidatePath('/', 'layout');
  redirect('/login?notice=password-updated');
}

export async function saveProfile(_: AuthState, f: FormData): Promise<AuthState> {
  if (!authConfigured()) return unavailable;
  const name = text(f, 'name');
  if (!name || name.length > 80) return { error: 'Inserisci un nome tra 1 e 80 caratteri.' };
  try {
    const supabase = await createSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Sessione scaduta. Accedi di nuovo.' };
    // ID dalla sessione verificata, mai dal form. RLS è applicata dal database.
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: name });
    if (error) return { error: 'Profilo non salvato. Verifica la configurazione del database.' };
    revalidatePath('/');
    return { message: 'Nome aggiornato.' };
  } catch { return { error: 'Servizio non raggiungibile. Riprova tra poco.' }; }
}

export async function logout() {
  if (authConfigured()) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) redirect('/?notice=logout-error');
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
