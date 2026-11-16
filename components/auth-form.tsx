'use client';
import { useActionState } from 'react';
import { login, register, changePassword, saveProfile, type AuthState } from '../app/auth/actions';
type Mode = 'login' | 'register' | 'password' | 'profile';
const actions = { login, register, password: changePassword, profile: saveProfile };

export default function AuthForm({mode, disabled = false, name = '', appointment}: {mode: Mode; disabled?: boolean; name?: string; appointment?:string}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(actions[mode], {});
  const newPassword = mode === 'register' || mode === 'password';
  return <form action={action} className="auth-form">
    {mode==='login'&&appointment&&<input type="hidden" name="appointment" value={appointment}/>}
    {(mode === 'register' || mode === 'profile') && <label>Il tuo nome<input name="name" required maxLength={80} autoComplete="name" defaultValue={name} disabled={disabled || pending}/></label>}
    {['login','register'].includes(mode) && <label>Email<input name="email" type="email" required maxLength={254} autoComplete="email" disabled={disabled || pending}/></label>}
    {(mode === 'login' || newPassword) && <label>{mode === 'password' ? 'Nuova password' : 'Password'}<input name="password" type="password" required minLength={newPassword ? 12 : undefined} maxLength={128} autoComplete={newPassword ? 'new-password' : 'current-password'} disabled={disabled || pending}/>{newPassword && <small>Da 12 a 128 caratteri. Usa una password diversa da quella di altri servizi.</small>}</label>}
    {newPassword && <label>Ripeti la password<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={disabled || pending}/></label>}
    {state.error && <p className="auth-alert error" role="alert">{state.error}</p>}
    {state.message && <p className="auth-alert success" role="status">{state.message}</p>}
    <button type="submit" className="button primary" disabled={disabled || pending}>{pending ? 'Un momento…' : ({login:'Accedi al tuo spazio',register:'Crea il tuo account',password:'Salva la nuova password',profile:'Salva il nome'})[mode]}</button>
  </form>;
}
