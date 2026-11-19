import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env=process.env;
const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_TEST_EMAIL_A','SUPABASE_TEST_PASSWORD_A','SUPABASE_TEST_EMAIL_B','SUPABASE_TEST_PASSWORD_B'];
if(env.CURA_RUN_DOCUMENT_TEST!=='1'||keys.some(key=>!env[key])){
  console.error('Test non eseguito: configura due account dedicati e CURA_RUN_DOCUMENT_TEST=1. Vedi docs/STEP04.md.');process.exit(1);
}
const client=()=>createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const a=client(),b=client(),anonymous=client();
const bucket='medical-documents',docs=[],visits=[];
const pdf=new Blob(['%PDF-1.4\n% Documento tecnico fittizio per test isolamento\n%%EOF\n'],{type:'application/pdf'});
try{
  const authA=await a.auth.signInWithPassword({email:env.SUPABASE_TEST_EMAIL_A,password:env.SUPABASE_TEST_PASSWORD_A});
  const authB=await b.auth.signInWithPassword({email:env.SUPABASE_TEST_EMAIL_B,password:env.SUPABASE_TEST_PASSWORD_B});
  assert.equal(authA.error,null,'Accesso A non riuscito');assert.equal(authB.error,null,'Accesso B non riuscito');
  const idA=authA.data.user.id,idB=authB.data.user.id;assert.notEqual(idA,idB);
  for(const [db,userId] of [[a,idA],[b,idB]]){
    const visit=await db.from('appointments').insert({user_id:userId,title:'Prova documenti temporanea',hospital:'Struttura fittizia',specialty:'Altra visita / prestazione',date:'2030-06-01',time:'10:00'}).select().single();
    assert.equal(visit.error,null,'Creazione visita di prova non riuscita');visits.push([db,visit.data.id]);
    const id=randomUUID(),path=`${userId}/${id}.pdf`;
    const metadata={id,user_id:userId,storage_path:path,original_name:'Test isolamento.pdf',mime_type:'application/pdf',size:pdf.size,status:'pending',appointment_id:visit.data.id};
    const row=await db.from('documents').insert(metadata).select().single();
    assert.equal(row.error,null,'Creazione metadati non riuscita: controllare la migrazione step 4');docs.push([db,id,path]);
    const signed=await db.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});
    assert.equal(signed.error,null,'Creazione autorizzazione upload non riuscita');
    const upload=await anonymous.storage.from(bucket).uploadToSignedUrl(path,signed.data.token,pdf,{contentType:'application/pdf',upsert:false,cacheControl:'0'});
    assert.equal(upload.error,null,'Upload diretto con token firmato non riuscito');
    const ready=await db.from('documents').update({status:'ready',version:2}).eq('id',id);assert.equal(ready.error,null);
    const own=await db.storage.from(bucket).download(path);assert.equal(own.error,null);assert.equal(await own.data.text(),await pdf.text());
    const overwrite=await db.storage.from(bucket).upload(path,pdf,{contentType:'application/pdf',upsert:true});assert.ok(overwrite.error,'Sovrascrittura di un oggetto già salvato consentita');
  }
  for(const [db,otherDoc,otherVisit] of [[a,docs[1],visits[1]],[b,docs[0],visits[0]]]){
    const read=await db.from('documents').select('*').eq('id',otherDoc[1]);assert.equal(read.error,null);assert.deepEqual(read.data,[]);
    const link=await db.from('documents').update({appointment_id:otherVisit[1]}).eq('id',docs[db===a?0:1][1]);assert.ok(link.error,'Collegamento a visita altrui consentito');
    const signed=await db.storage.from(bucket).createSignedUrl(otherDoc[2],60);assert.ok(signed.error,'Un utente può generare link per un file altrui');
    const download=await db.storage.from(bucket).download(otherDoc[2]);assert.ok(download.error,'Download file altrui consentito');
    await db.storage.from(bucket).remove([otherDoc[2]]);
    const stillThere=await otherDoc[0].storage.from(bucket).download(otherDoc[2]);assert.equal(stillThere.error,null,'Eliminazione di un file altrui consentita');
    const remove=await db.from('documents').delete().eq('id',otherDoc[1]).select();assert.equal(remove.error,null);assert.deepEqual(remove.data,[]);
  }
  const publicUrl=anonymous.storage.from(bucket).getPublicUrl(docs[0][2]).data.publicUrl;
  assert.equal((await fetch(publicUrl)).ok,false,'Il bucket consente accesso pubblico');
  const anonMetadata=await anonymous.from('documents').select('*');assert.ok(anonMetadata.error||anonMetadata.data.length===0);
  console.log('PASS: upload firmato, lettura propria, immutabilità, isolamento metadati/file e collegamenti, accesso pubblico bloccato.');
} finally {
  for(const [db,id,path] of docs){
    const file=await db.storage.from(bucket).remove([path]);
    if(file.error)console.error('Pulizia file di prova da completare:',id);
    else{const row=await db.from('documents').delete().eq('id',id);if(row.error)console.error('Pulizia metadati di prova da completare:',id);}
  }
  for(const [db,id] of visits)await db.from('appointments').delete().eq('id',id);
  await Promise.allSettled([a.auth.signOut(),b.auth.signOut()]);
}
