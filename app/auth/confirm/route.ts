import { NextRequest, NextResponse } from 'next/server';
import { createSupabase } from '../../../lib/supabase/server';
import { authConfigured, emailSignupEnabled } from '../../../lib/supabase/config';
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  // Destinazioni fisse: nessun parametro next può portare fuori dall'app.
  const destination = request.nextUrl.clone();
  destination.search = '';
  destination.pathname = '/login';
  destination.searchParams.set('notice', 'invalid-link');
  if (authConfigured() && emailSignupEnabled() && token_hash && (type === 'signup' || type === 'email')) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      destination.search = '';
      {
        await supabase.auth.signOut({ scope: 'local' });
        destination.searchParams.set('notice', 'confirmed');
      }
    }
  }
  // Location relativa: funziona anche dietro proxy e non espone l'host interno.
  const response = new NextResponse(null, { status: 307, headers: { Location: destination.pathname + destination.search } });
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
