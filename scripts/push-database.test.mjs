import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {generateVAPIDKeys} from 'web-push';
import {randomBytes} from 'node:crypto';
import {specialties} from '../lib/appointments.ts';

const first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',second='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key=generateVAPIDKeys().publicKey,auth=randomBytes(16).toString('base64url');
let db;
let specialtyBefore,specialtyAfter;
const rows=async(sql,params=[]) => (await db.query(sql,params)).rows;
const asUser=async uid=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated');};
const asAdmin=()=>db.exec('reset role');
const asWorker=()=>db.exec('reset role;set role service_role');
async function device(uid=first,suffix='one'){
  await asUser(uid);
  const [r]=await rows('select public.register_visilab_push($1,$2,$3,$4) id',[`https://web.push.apple.com/${uid}/${suffix}`,key,auth,key]);
  await asAdmin();await db.query("update public.push_subscriptions set created_at=now()-interval '1 day' where id=$1",[r.id]);return r.id;
}
async function visit(uid=first,overrides=''){
  await asAdmin();
  const [r]=await rows(`insert into public.appointments(user_id,title,specialty,hospital,date,time,doctor,notes,reminder)
    values($1,'Test riservato','Altra visita / prestazione','Struttura privata',(now() at time zone 'Europe/Rome')::date+1,'12:00','','',date_trunc('minute',(now()-interval '1 minute') at time zone 'Europe/Rome')) returning id`,[uid]);
  if(overrides)await db.exec(`update public.appointments set ${overrides} where id='${r.id}'`);
  return r.id;
}
const claim=async()=>{await asWorker();return rows('select * from public.claim_visilab_reminders(20)');};
const prepare=async id=>(await rows('select public.prepare_visilab_reminder($1) payload',[id]))[0].payload;

before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon,service_role;set timezone='UTC';`);
  for(const file of ['202611150002_appointments.sql','202611150004_pending_appointments.sql','202611160005_push_notifications.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  // The notifications migration must also be safe when pasted a second time.
  await db.exec(await readFile(new URL('../supabase/migrations/202611160005_push_notifications.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611170006_iphone_notifications.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1)',[first]);
  for(const specialty of ['Laboratorio','Altra visita','Cardiologia'])await db.query("insert into public.appointments(user_id,title,specialty,hospital,date,time,notes,version) values($1,'Visita conservata',$2,'Struttura di prova','2030-05-20','10:00','Nota conservata',3)",[first,specialty]);
  specialtyBefore=await rows('select * from public.appointments order by id');
  const specialtyMigration=await readFile(new URL('../supabase/migrations/202611190007_specialties.sql',import.meta.url),'utf8');
  await db.exec(specialtyMigration);await db.exec(specialtyMigration);
  specialtyAfter=await rows('select * from public.appointments order by id');
  const pendingReminderMigration=await readFile(new URL('../supabase/migrations/202611220008_pending_reminders.sql',import.meta.url),'utf8');
  await db.exec(pendingReminderMigration);await db.exec(pendingReminderMigration);
  assert.deepEqual(await rows('select * from public.appointments order by id'),specialtyAfter);
});
beforeEach(async()=>{await asAdmin();await db.exec('truncate auth.users cascade;update public.push_scheduler_status set last_run_at=null');await db.query('insert into auth.users(id) values($1),($2)',[first,second]);});
after(async()=>{await db?.close();});

async function pendingVisit(uid=first,indicative=false){
  const id=await visit(uid);await asAdmin();
  await db.query(`update public.appointments set booking_status='pending',hospital='',date=${indicative?"((now()-interval '2 days') at time zone 'Europe/Rome')::date":'null'},time=${indicative?"time '10:00'":'null'} where id=$1`,[id]);
  return id;
}
test('invia il promemoria per prenotare senza data visita e anche dopo una data puramente indicativa',async()=>{
  const subscription=await device();
  for(const indicative of [false,true]){
    const id=await pendingVisit(first,indicative);const [job]=await claim();assert.ok(job);
    const payload=await prepare(job.id);assert.equal(payload.bookingStatus,'pending');assert.equal(payload.appointmentId,id);assert.equal(payload.subscriptionId,subscription);
    assert.equal((await claim()).length,0);
  }
});
test('un promemoria di prenotazione spostato, rimosso o eliminato non viene inviato alla vecchia scadenza',async()=>{
  await device();
  for(const change of ['reschedule','clear','delete']){
    const id=await pendingVisit();const [job]=await claim();await asAdmin();
    if(change==='reschedule')await db.query("update public.appointments set reminder=reminder+interval '1 hour' where id=$1",[id]);
    if(change==='clear')await db.query('update public.appointments set reminder=null where id=$1',[id]);
    if(change==='delete')await db.query('delete from public.appointments where id=$1',[id]);
    await asWorker();assert.equal(await prepare(job.id),null);
  }
});
test('la conferma della visita non ripete un promemoria già inviato e aggiorna il tipo prima dell’invio',async()=>{
  await device();
  const firstVisit=await pendingVisit(),[firstJob]=await claim();assert.equal((await prepare(firstJob.id)).bookingStatus,'pending');
  await db.query("update public.push_deliveries set state='sent' where id=$1",[firstJob.id]);
  const confirm=async id=>{await asAdmin();await db.query("update public.appointments set booking_status='confirmed',hospital='Struttura confermata',date=(now() at time zone 'Europe/Rome')::date+1,time='10:00' where id=$1",[id]);};
  await confirm(firstVisit);assert.equal((await claim()).length,0);
  const secondVisit=await pendingVisit(),[secondJob]=await claim();await confirm(secondVisit);await asWorker();
  assert.equal((await prepare(secondJob.id)).bookingStatus,'confirmed');
});
test('i controlli sui promemoria delle visite confermate restano attivi',async()=>{
  const id=await pendingVisit();
  await assert.rejects(()=>db.query("update public.appointments set done=true where id=$1",[id]),/appointments_booking_fields_check/);
  await db.query("update public.appointments set booking_status='confirmed',hospital='Struttura',date=(now() at time zone 'Europe/Rome')::date+1,time='10:00' where id=$1",[id]);
  await assert.rejects(()=>db.query("update public.appointments set reminder=date+time where id=$1",[id]),/appointments_booking_reminder_check/);
});

test('migrazione specialità rieseguibile: cambia le etichette e conserva tutti i dettagli della visita',()=>{
  assert.equal(specialtyAfter.length,specialtyBefore.length);
  for(let i=0;i<specialtyBefore.length;i++){
    const old=specialtyBefore[i],updated=specialtyAfter[i],changed=old.specialty!=='Cardiologia';
    assert.equal(updated.specialty,old.specialty==='Laboratorio'?'Analisi':old.specialty==='Altra visita'?'Altra visita / prestazione':old.specialty);
    assert.equal(updated.version,old.version+(changed?1:0));
    assert.deepEqual({...updated,specialty:old.specialty,version:old.version},old);
  }
});
test('il database accetta tutte le nuove specialità e rifiuta quelle escluse',async()=>{
  for(const specialty of specialties)await db.query("insert into public.appointments(user_id,title,specialty,hospital,date,time) values($1,'Verifica catalogo',$2,'Struttura di prova','2030-05-20','10:00')",[first,specialty]);
  for(const specialty of ['Laboratorio','Altra visita','Pediatria','Medicina dello sport','Psichiatria','Psicologia','Geriatria'])await assert.rejects(()=>db.query("insert into public.appointments(user_id,title,specialty,hospital,date,time) values($1,'Verifica catalogo',$2,'Struttura di prova','2030-05-20','10:00')",[first,specialty]),/appointments_specialty_check/);
});

test('aggiornamento iPhone conserva telefoni e visite, elimina i vecchi PC e ne impedisce la registrazione',async()=>{
  const iphone=await device(),appointment=await visit();await asAdmin();
  await db.query('insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,vapid_public_key) values($1,$2,$3,$4,$5)',[first,'https://fcm.googleapis.com/desktop',key,auth,key]);
  const migration=await readFile(new URL('../supabase/migrations/202611170006_iphone_notifications.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  const subscriptions=await rows('select id from public.push_subscriptions');assert.deepEqual(subscriptions,[{id:iphone}]);
  assert.equal((await rows('select id from public.appointments where id=$1',[appointment])).length,1);
  await asUser(first);
  await assert.rejects(()=>rows('select public.register_visilab_push($1,$2,$3,$4)',['https://fcm.googleapis.com/another-desktop',key,auth,key]),/non valido/);
  assert.equal((await claim()).length,1);
});

test('RLS: un account non vede o elimina i dispositivi dell’altro; nessun accesso al worker',async()=>{
  const id=await device(first);await device(second);
  await asUser(second);assert.equal((await rows('select * from public.push_subscriptions')).length,1);
  assert.equal((await rows('delete from public.push_subscriptions where id=$1 returning id',[id])).length,0);
  assert.equal((await rows('select public.claim_visilab_push_test($1) payload',[id]))[0].payload,null);
  await assert.rejects(()=>rows('select * from public.claim_visilab_reminders(20)'),/permission denied/);
  await assert.rejects(()=>rows('select * from public.push_deliveries'),/permission denied/);
  await assert.rejects(()=>rows('select public.register_visilab_push($1,$2,$3,$4)',[`https://web.push.apple.com/${first}/one`,key,auth,key]),/riattivare/);
});

test('prova limitata a una ogni minuto e registrazione limitata a 10 dispositivi',async()=>{
  const id=await device();await asUser(first);
  assert.ok((await rows('select public.claim_visilab_push_test($1) payload',[id]))[0].payload);
  assert.equal((await rows('select public.claim_visilab_push_test($1) payload',[id]))[0].payload,null);
  for(let i=1;i<10;i++)await device(first,String(i));
  await asUser(first);await assert.rejects(()=>rows('select public.register_visilab_push($1,$2,$3,$4)',['https://web.push.apple.com/extra',key,auth,key]),/10 dispositivi/);
  await assert.rejects(()=>rows('select public.register_visilab_push($1,$2,$3,$4)',['https://127.0.0.1/private',key,auth,key]),/non valido/);
});

test('claim atomico: nessun doppione e nessuna visita bloccata dopo il primo batch',async()=>{
  await device();await device(second);
  for(let i=0;i<25;i++)await visit(i%2?second:first);
  const initial=await claim(),rest=await claim(),empty=await claim();
  assert.equal(initial.length,20);assert.equal(rest.length,5);assert.equal(empty.length,0);
  const payload=await prepare(initial[0].id);assert.ok(payload);
  await asAdmin();
  const own=(await rows('select a.user_id as owner,s.user_id as recipient from public.push_deliveries d join public.appointments a on a.id=d.appointment_id join public.push_subscriptions s on s.id=d.subscription_id where d.id=$1',[initial[0].id]))[0];
  assert.equal(own.owner,own.recipient);
  await asWorker();
  assert.equal(await prepare(initial[0].id),null);
});

test('modifica promemoria, visita effettuata e cancellazione fermano un invio già prenotato',async()=>{
  await device();
  for(const change of ['reminder', 'done','pending','delete','device']){
    const appointment=await visit(),[job]=await claim();assert.ok(job);
    await asAdmin();
    if(change==='reminder')await db.query("update public.appointments set reminder=reminder+interval '1 hour' where id=$1",[appointment]);
    if(change==='done')await db.query('update public.appointments set done=true where id=$1',[appointment]);
    if(change==='pending')await db.query("update public.appointments set booking_status='pending',reminder=null,date=null,hospital='' where id=$1",[appointment]);
    if(change==='delete')await db.query('delete from public.appointments where id=$1',[appointment]);
    if(change==='device')await db.exec('delete from public.push_subscriptions');
    await asWorker();assert.equal(await prepare(job.id),null,change);
  }
});

test('una nota modificata non ripete un avviso già accettato',async()=>{
  await device();const appointment=await visit();const [job]=await claim();assert.ok(await prepare(job.id));
  await db.query("update public.push_deliveries set state='sent' where id=$1",[job.id]);
  await asAdmin();await db.query("update public.appointments set notes='Nota aggiornata',version=version+1 where id=$1",[appointment]);
  assert.equal((await claim()).length,0);
});

test('non invia avvisi troppo vecchi, visite passate, già effettuate o dispositivi attivati dopo la scadenza',async()=>{
  await device();
  await visit(first,"reminder=reminder-interval '1 hour'");
  await visit(first,'done=true');
  await visit(first,"date=((now()-interval '1 minute') at time zone 'Europe/Rome')::date,time=date_trunc('minute',(now()-interval '1 minute') at time zone 'Europe/Rome')::time,reminder=date_trunc('minute',(now()-interval '2 minutes') at time zone 'Europe/Rome')");
  assert.equal((await claim()).length,0);
  await visit();await asAdmin();await db.exec('update public.push_subscriptions set created_at=now()');
  assert.equal((await claim()).length,0);
});

test('conversione SQL degli orari italiani coerente con ora solare e legale',async()=>{
  const [r]=await rows("select extract(epoch from timestamp '2027-01-15 10:00' at time zone 'Europe/Rome')::bigint winter,extract(epoch from timestamp '2027-07-15 10:00' at time zone 'Europe/Rome')::bigint summer");
  assert.equal(Number(r.winter)*1000,Date.parse('2027-01-15T09:00:00Z'));
  assert.equal(Number(r.summer)*1000,Date.parse('2027-07-15T08:00:00Z'));
});
