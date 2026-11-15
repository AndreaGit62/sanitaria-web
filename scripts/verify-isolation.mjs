import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const required = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_TEST_EMAIL_A','SUPABASE_TEST_PASSWORD_A','SUPABASE_TEST_EMAIL_B','SUPABASE_TEST_PASSWORD_B'];
if (env.CURA_RUN_ISOLATION_TEST !== '1' || required.some(key => !env[key])) {
  console.error('Test non eseguito: configura due account dedicati e CURA_RUN_ISOLATION_TEST=1. Vedi docs/SUPABASE.md.');
  process.exit(1);
}
const client = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const a = client(), b = client(), anonymous = client();
const created = [];
try {
  const loginA = await a.auth.signInWithPassword({email:env.SUPABASE_TEST_EMAIL_A,password:env.SUPABASE_TEST_PASSWORD_A});
  const loginB = await b.auth.signInWithPassword({email:env.SUPABASE_TEST_EMAIL_B,password:env.SUPABASE_TEST_PASSWORD_B});
  assert.equal(loginA.error,null,'Accesso account A non riuscito');
  assert.equal(loginB.error,null,'Accesso account B non riuscito');
  const idA = loginA.data.user.id, idB = loginB.data.user.id;
  assert.notEqual(idA,idB,'Servono due account diversi');
  for (const [db,id,name] of [[a,idA,'Test isolamento A'],[b,idB,'Test isolamento B']]) {
    const own = await db.from('profiles').upsert({id,display_name:name}).select();
    assert.equal(own.error,null,'Salvataggio proprio profilo non riuscito');
    assert.equal(own.data.length,1);
  }
  for (const [db,otherId] of [[a,idB],[b,idA]]) {
    const read = await db.from('profiles').select('*').eq('id',otherId);
    assert.equal(read.error,null);
    assert.deepEqual(read.data,[],'Un account può leggere il profilo altrui');
    const update = await db.from('profiles').update({display_name:'Modifica non autorizzata'}).eq('id',otherId).select();
    assert.equal(update.error,null);
    assert.deepEqual(update.data,[],'Un account può modificare il profilo altrui');
    const overwrite = await db.from('profiles').upsert({id:otherId,display_name:'Sovrascrittura non autorizzata'});
    assert.ok(overwrite.error,'Una upsert può sovrascrivere il profilo altrui');
  }
  const anonRead = await anonymous.from('profiles').select('*');
  assert.ok(anonRead.error || anonRead.data.length === 0,'Lettura anonima non bloccata');
  const sample = {title:'Test tecnico isolamento',specialty:'Altra visita',hospital:'Struttura fittizia',date:'2030-05-20',time:'10:00',doctor:'',notes:'Record temporaneo creato e rimosso dal test',reminder:null,done:false};
  const inserted = [];
  for (const [db,userId] of [[a,idA],[b,idB]]) {
    const row = await db.from('appointments').insert({...sample,user_id:userId}).select().single();
    assert.equal(row.error,null,'Inserimento visita propria non riuscito: eseguire la migrazione appuntamenti');
    created.push([db,row.data.id]);
    inserted.push(row.data);
  }
  for (const [db,otherId,otherOwner] of [[a,inserted[1].id,idB],[b,inserted[0].id,idA]]) {
    const read=await db.from('appointments').select('*').eq('id',otherId);
    assert.equal(read.error,null);assert.deepEqual(read.data,[],'Lettura visita altrui consentita');
    const update=await db.from('appointments').update({title:'Modifica non autorizzata'}).eq('id',otherId).select();
    assert.equal(update.error,null);assert.deepEqual(update.data,[],'Modifica visita altrui consentita');
    const remove=await db.from('appointments').delete().eq('id',otherId).select();
    assert.equal(remove.error,null);assert.deepEqual(remove.data,[],'Eliminazione visita altrui consentita');
    const spoof=await db.from('appointments').insert({...sample,user_id:otherOwner});
    assert.ok(spoof.error,'Inserimento per un altro proprietario consentito');
  }
  const first=inserted[0];
  const update=await a.from('appointments').update({done:true,version:2}).eq('id',first.id).eq('version',1).select();
  assert.equal(update.error,null);assert.equal(update.data.length,1);
  const stale=await a.from('appointments').update({done:false,version:2}).eq('id',first.id).eq('version',1).select();
  assert.equal(stale.error,null);assert.deepEqual(stale.data,[],'Una versione obsoleta sovrascrive una visita aggiornata');
  const anonVisits=await anonymous.from('appointments').select('*');
  assert.ok(anonVisits.error || anonVisits.data.length===0,'Lettura anonima delle visite consentita');
  console.log('PASS: profili e visite isolati tra utenti; inserimento con proprietario falso rifiutato; aggiornamenti obsoleti bloccati.');
} finally {
  for(const [db,id] of created) {
    const {error}=await db.from('appointments').delete().eq('id',id);
    if(error) console.error('Pulizia del record di prova non riuscita:',id);
  }
  await Promise.allSettled([a.auth.signOut(),b.auth.signOut()]);
}
