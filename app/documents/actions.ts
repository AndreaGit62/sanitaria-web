'use server';
import { revalidatePath } from 'next/cache';
import { createSupabase } from '../../lib/supabase/server';
import { authConfigured } from '../../lib/supabase/config';
import { validId } from '../../lib/appointments';
import { DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES, documentFromRow, parseDocumentMetadata, validDocumentHeader, type PrivateDocument } from '../../lib/documents';

type DocumentResult = {error:string;document?:never} | {error?:never;document:PrivateDocument};
async function session() {
  if (!authConfigured()) throw new Error('Accesso non configurato.');
  const db=await createSupabase();
  const {data:{user},error}=await db.auth.getUser();
  if (error || !user) throw new Error('Sessione scaduta. Accedi di nuovo.');
  return {db,user};
}
const columns='*, appointment:appointments(title,date)';
const unavailable='Archivio non disponibile. Verifica la configurazione dello step 4 in Supabase e riprova.';
const failed='Operazione non confermata. Aggiorna l’archivio prima di riprovare.';

export async function prepareDocument(input: unknown, appointmentId: string | null): Promise<
  {error:string;document?:never;path?:never;token?:never} | {error?:never;document:PrivateDocument;path:string;token:string}
> {
  let metadata;
  try {metadata=parseDocumentMetadata(input);} catch(error) {return {error:error instanceof Error?error.message:'Documento non valido.'};}
  if (appointmentId !== null && !validId(appointmentId)) return {error:'Visita collegata non valida.'};
  try {
    const {db,user}=await session();
    if (appointmentId) {
      const own=await db.from('appointments').select('id').eq('id',appointmentId).eq('user_id',user.id).maybeSingle();
      if (own.error || !own.data) return {error:'La visita selezionata non è disponibile. Aggiorna l’agenda.'};
    }
    const id=crypto.randomUUID();
    const path=`${user.id}/${id}.${metadata.mime==='application/pdf'?'pdf':'jpg'}`;
    const row=await db.from('documents').insert({id,user_id:user.id,original_name:metadata.name,mime_type:metadata.mime,size:metadata.size,storage_path:path,appointment_id:appointmentId,status:'pending'}).select(columns).single();
    if (row.error || !row.data) return {error:unavailable};
    const signed=await db.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path,{upsert:false});
    if (signed.error || !signed.data) {
      await db.from('documents').delete().eq('id',id).eq('user_id',user.id).eq('status','pending');
      return {error:unavailable};
    }
    return {document:documentFromRow(row.data),path,token:signed.data.token};
  } catch {return {error:'Preparazione non riuscita. Controlla la connessione e la sessione.'};}
}

export async function completeDocument(id: string): Promise<DocumentResult> {
  if (!validId(id)) return {error:'Documento non valido.'};
  try {
    const {db,user}=await session();
    const row=await db.from('documents').select(columns).eq('id',id).eq('user_id',user.id).maybeSingle();
    if (row.error || !row.data) return {error:'Documento non disponibile.'};
    if (row.data.status==='ready') return {document:documentFromRow(row.data)};
    const file=await db.storage.from(DOCUMENT_BUCKET).download(row.data.storage_path);
    if (file.error || !file.data) return {error:'Caricamento non completato. Se hai interrotto l’invio, rimuovi questa voce e seleziona di nuovo il file.'};
    const blob=file.data;
    const valid=blob.size>0 && blob.size<=MAX_DOCUMENT_BYTES && blob.size===Number(row.data.size)
      && blob.type.split(';')[0]===row.data.mime_type
      && validDocumentHeader(new Uint8Array(await blob.slice(0,8).arrayBuffer()),row.data.mime_type);
    if (!valid) return {error:'Il file caricato non corrisponde al PDF/JPG atteso. Rimuovilo e scegli un documento valido.'};
    const updated=await db.from('documents').update({status:'ready',version:row.data.version+1}).eq('id',id).eq('user_id',user.id).eq('version',row.data.version).select(columns).maybeSingle();
    if (updated.error || !updated.data) return {error:failed};
    revalidatePath('/');
    return {document:documentFromRow(updated.data)};
  } catch {return {error:'Verifica interrotta. Aggiorna l’archivio e usa “Verifica upload” per controllare il file.'};}
}

export async function linkDocument(id: string, appointmentId: string | null, version: number): Promise<DocumentResult> {
  if (!validId(id) || (appointmentId!==null&&!validId(appointmentId)) || !Number.isSafeInteger(version) || version<1) return {error:'Collegamento non valido.'};
  try {
    const {db,user}=await session();
    if (appointmentId) {
      const visit=await db.from('appointments').select('id').eq('id',appointmentId).eq('user_id',user.id).maybeSingle();
      if (visit.error || !visit.data) return {error:'La visita non è disponibile nel tuo account.'};
    }
    const updated=await db.from('documents').update({appointment_id:appointmentId,version:version+1}).eq('id',id).eq('user_id',user.id).eq('version',version).select(columns).maybeSingle();
    if (updated.error || !updated.data) return {error:failed};
    revalidatePath('/');
    return {document:documentFromRow(updated.data)};
  } catch {return {error:failed};}
}

export async function openDocument(id: string, download=false): Promise<{error:string;url?:never}|{error?:never;url:string}> {
  if (!validId(id) || typeof download!=='boolean') return {error:'Documento non valido.'};
  try {
    const {db,user}=await session();
    const {data,error}=await db.from('documents').select('storage_path,original_name').eq('id',id).eq('user_id',user.id).eq('status','ready').maybeSingle();
    if (error || !data) return {error:'Documento non disponibile o caricamento ancora da completare.'};
    const signed=await db.storage.from(DOCUMENT_BUCKET).createSignedUrl(data.storage_path,60,download?{download:data.original_name}:undefined);
    if (signed.error || !signed.data) return {error:'Apertura non riuscita. Il file potrebbe essere stato rimosso.'};
    return {url:signed.data.signedUrl};
  } catch {return {error:'Impossibile aprire il file. Verifica la connessione e la sessione.'};}
}

export async function deleteDocument(id: string): Promise<{error?:string;id?:string}> {
  if (!validId(id)) return {error:'Documento non valido.'};
  try {
    const {db,user}=await session();
    const row=await db.from('documents').select('storage_path').eq('id',id).eq('user_id',user.id).maybeSingle();
    if (row.error || !row.data) return {error:'Documento non disponibile. Aggiorna l’archivio.'};
    // Prima il file, poi la scheda: in caso di errore la voce resta visibile e riprovabile.
    const removed=await db.storage.from(DOCUMENT_BUCKET).remove([row.data.storage_path]);
    if (removed.error) return {error:'File non rimosso. La voce resta nell’archivio: riprova.'};
    const deleted=await db.from('documents').delete().eq('id',id).eq('user_id',user.id).select('id').maybeSingle();
    if (deleted.error || !deleted.data) return {error:'File rimosso, ma la voce è ancora presente. Aggiorna e ripeti Elimina per completare.'};
    revalidatePath('/');
    return {id};
  } catch {return {error:'Eliminazione non confermata. Aggiorna l’archivio prima di riprovare.'};}
}
