'use server';
import { revalidatePath } from 'next/cache';
import { authConfigured } from '../../lib/supabase/config';
import { createSupabase } from '../../lib/supabase/server';
import { fromRow, parseVisit, reminderEpoch, validId, type Visit } from '../../lib/appointments';

type Result = { error: string; visit?: never; id?: never } | { error?: never; visit?: Visit; id?: string };
const conflict = 'Appuntamento modificato o rimosso da un altro dispositivo. Aggiorna l’agenda prima di riprovare.';

async function session() {
  if (!authConfigured()) throw new Error('Accesso non configurato.');
  const db = await createSupabase();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error('Sessione scaduta. Accedi di nuovo.');
  return { db, user };
}
function databaseError(code: string) {
  if(code==='PGRST204'||code==='42703')return 'Per le visite da prenotare serve il nuovo aggiornamento SQL in Supabase.';
  if (code === 'PGRST205' || code === '42P01') return 'Archivio appuntamenti da attivare. Esegui la configurazione dello step 3 in Supabase.';
  if (code === '42501') return 'Operazione non consentita. Accedi di nuovo e verifica la configurazione dell’archivio.';
  if (code === '23514' || code === '22007') return 'Controlla i campi: data, ora e promemoria non sono validi.';
  return 'Salvataggio non riuscito. Riprova: i dati non sono stati confermati.';
}

export async function saveAppointment(input: unknown, id?: string, version?: number): Promise<Result> {
  let visit;
  try { visit = parseVisit(input); } catch (error) { return { error: error instanceof Error ? error.message : 'Dati non validi.' }; }
  if (id !== undefined && (!validId(id) || !Number.isSafeInteger(version) || version! < 1)) return { error:'Identificativo dell’appuntamento non valido.' };
  try {
    const { db, user } = await session();
    if(visit.reminder&&reminderEpoch(visit.reminder)<=Date.now()){
      const previous=id?await db.from('appointments').select('reminder').eq('user_id',user.id).eq('id',id).eq('version',version!).maybeSingle():null;
      if(!previous?.data?.reminder||String(previous.data.reminder).slice(0,16)!==visit.reminder)return {error:'Scegli un giorno e un’ora futuri per il nuovo promemoria.'};
    }
    const {bookingStatus,...fields}=visit;
    const data = { ...fields, booking_status:bookingStatus, date:visit.date||null, time:visit.time||null, reminder:visit.reminder || null };
    const response = id
      ? await db.from('appointments').update({ ...data, version:version! + 1 }).eq('id',id).eq('user_id',user.id).eq('version',version!).select().maybeSingle()
      : await db.from('appointments').insert({ ...data, user_id:user.id }).select().single();
    if (response.error) return {error:databaseError(response.error.code)};
    if (!response.data) return {error:conflict};
    revalidatePath('/');
    return {visit:fromRow(response.data)};
  } catch (error) { return {error:error instanceof Error && error.message.startsWith('Sessione') ? error.message : 'Servizio non raggiungibile. I dati non sono stati confermati.'}; }
}

export async function setAppointmentStatus(id: string, version: number, done: boolean): Promise<Result> {
  if (!validId(id) || !Number.isSafeInteger(version) || version < 1 || typeof done !== 'boolean') return {error:'Appuntamento non valido.'};
  try {
    const { db, user } = await session();
    const {data,error} = await db.from('appointments').update({done,version:version+1}).eq('id',id).eq('user_id',user.id).eq('booking_status','confirmed').eq('version',version).select().maybeSingle();
    if (error) return {error:databaseError(error.code)};
    if (!data) return {error:conflict};
    revalidatePath('/');
    return {visit:fromRow(data)};
  } catch { return {error:'Operazione non riuscita. Verifica la connessione e la sessione.'}; }
}

export async function deleteAppointment(id: string, version: number): Promise<Result> {
  if (!validId(id) || !Number.isSafeInteger(version) || version < 1) return {error:'Appuntamento non valido.'};
  try {
    const {db,user} = await session();
    const {data,error} = await db.from('appointments').delete().eq('id',id).eq('user_id',user.id).eq('version',version).select('id').maybeSingle();
    if (error) return {error:databaseError(error.code)};
    if (!data) return {error:conflict};
    revalidatePath('/');
    return {id:data.id};
  } catch { return {error:'Eliminazione non riuscita. Verifica la connessione e la sessione.'}; }
}
