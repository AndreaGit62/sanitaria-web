import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVisit, validId, fromRow } from '../lib/appointments.ts';
const good = {title:'Visita di prova',specialty:'Altra visita',hospital:'Struttura demo',date:'2028-02-29',time:'10:30',doctor:'',notes:'',reminder:'2028-02-28T18:00',done:false};

test('le proprietà del proprietario inviate dal browser non entrano nei dati salvati', () => {
  const parsed = parseVisit({...good,user_id:'altro-utente',id:'id-forzato',version:20,title:' Visita di prova '});
  assert.equal(parsed.title,'Visita di prova');
  for (const property of ['user_id','id','version']) assert.equal(Object.hasOwn(parsed,property),false);
});
test('date impossibili e orari malformati vengono rifiutati', () => {
  for (const date of ['2027-02-29','2028-02-30','2028-13-01','1899-12-31','2101-01-01','2028-2-01']) assert.throws(()=>parseVisit({...good,date}));
  for (const time of ['24:00','12:60','9:30','10:30:00']) assert.throws(()=>parseVisit({...good,time}));
});
test('promemoria successivi o uguali alla visita non vengono salvati', () => {
  for (const reminder of ['2028-02-29T10:30','2028-03-01T09:00','2028-02-30T09:00','2028-02-28T25:00']) assert.throws(()=>parseVisit({...good,reminder}));
  assert.equal(parseVisit({...good,reminder:''}).reminder,'');
});
test('campi obbligatori, limiti e tipi vengono validati sul server', () => {
  for (const value of [null,{}, {...good,title:' '},{...good,title:'a'.repeat(121)},{...good,hospital:''},{...good,notes:'a'.repeat(2001)},{...good,done:'false'},{...good,specialty:'Valore inventato'}]) assert.throws(()=>parseVisit(value));
});
test('normalizzazione degli orari restituiti da Postgres per modifica e calendario', () => {
  const mapped=fromRow({...good,id:'f9ae2a8f-d920-48fb-8d2c-e599ff3346b3',version:2,time:'10:30:00',reminder:'2028-02-28T18:00:00'});
  assert.equal(mapped.time,'10:30');assert.equal(mapped.reminder,'2028-02-28T18:00');assert.equal(mapped.version,2);
  assert.equal(fromRow({...mapped,reminder:null}).reminder,'');
});
test('gli identificativi degli appuntamenti remoti devono essere UUID',()=>{
  assert.ok(validId('f9ae2a8f-d920-48fb-8d2c-e599ff3346b3'));
  for(const id of ['demo-1','',null,'../../appointments'])assert.equal(validId(id),false);
});

test('visite da prenotare ammettono data e struttura ancora da definire',()=>{
  const draft={...good,bookingStatus:'pending',date:'',time:'',hospital:'',reminder:'',done:true};
  for(const partial of [{},{date:good.date},{hospital:good.hospital}]){
    const parsed=parseVisit({...draft,...partial});
    assert.equal(parsed.bookingStatus,'pending');assert.equal(parsed.done,false);
    assert.equal(parsed.title,good.title);
  }
  assert.throws(()=>parseVisit({...draft,reminder:good.reminder}));
  assert.throws(()=>parseVisit({...draft,date:'2027-02-29'}));
  assert.throws(()=>parseVisit({...draft,bookingStatus:'inventato'}));
});
test('data e struttura promuovono la visita preservando note e dettagli',()=>{
  const parsed=parseVisit({...good,bookingStatus:'pending',time:'',reminder:'',notes:'Portare prescrizione'});
  assert.equal(parsed.bookingStatus,'confirmed');assert.equal(parsed.time,'');
  assert.equal(parsed.notes,'Portare prescrizione');assert.equal(parsed.hospital,good.hospital);
  assert.throws(()=>parseVisit({...good,date:''}));
});
test('orario facoltativo e promemoria prima del giorno della visita',()=>{
  assert.equal(parseVisit({...good,time:''}).bookingStatus,'confirmed');
  assert.throws(()=>parseVisit({...good,time:'',reminder:'2028-02-29T00:00'}));
});
test('righe da prenotare senza data o ora non producono stringhe null',()=>{
  const mapped=fromRow({...good,date:null,time:null,reminder:null,booking_status:'pending'});
  assert.equal(mapped.date,'');assert.equal(mapped.time,'');assert.equal(mapped.reminder,'');
  assert.equal(mapped.bookingStatus,'pending');
  assert.equal(fromRow({...good}).bookingStatus,'confirmed');
});
