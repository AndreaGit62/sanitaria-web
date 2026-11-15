export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
// Registrazione via email sospesa finché non viene configurato SMTP.
export function emailSignupEnabled() { return process.env.AUTH_EMAIL_SIGNUP_ENABLED === 'true'; }
export function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) throw new Error('Configura NEXT_PUBLIC_SITE_URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Il sito deve usare HTTPS, salvo localhost.');
  return url.origin;
}
