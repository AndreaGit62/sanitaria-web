import test from 'node:test';
import assert from 'node:assert/strict';
import {collectReportVisits,sortReportVisits,bookingLabel,outcomeLabel,reportDate} from '../lib/visit-report.ts';

const visit=(id,date='',time='',bookingStatus='confirmed')=>({id,title:'Visita '+id,specialty:'Cardiologia',hospital:'Struttura di prova',date,time,doctor:'',notes:'',reminder:'',done:false,bookingStatus});
test('ordine cronologico completo: effettuate incluse, orari da definire dopo quelli noti, senza data in fondo',()=>{
  const input=[visit('undated','','','pending'),visit('late','2027-03-01','12:00'),visit('unknown','2027-01-01'),visit('early','2027-01-01','08:00'),{...visit('done','2026-01-01','10:00'),done:true},visit('tentative','2027-02-01','','pending')];
  assert.deepEqual(sortReportVisits(input).map(v=>v.id),['done','early','unknown','tentative','late','undated']);
  assert.equal(input[0].id,'undated');
});
test('prenotazione sempre esplicita e distinta dall’esito della visita',()=>{
  const confirmed=visit('one','2027-01-01'),pending=visit('two','','','pending');
  assert.equal(bookingLabel(confirmed),'Prenotata');assert.equal(bookingLabel({...confirmed,done:true}),'Prenotata');
  assert.equal(outcomeLabel({...confirmed,done:true}),'Effettuata');assert.equal(bookingLabel(pending),'Da prenotare');assert.equal(outcomeLabel(pending),'Da organizzare');
  assert.equal(reportDate('2027-01-09'),'09/01/2027');assert.equal(reportDate(''),'Da definire');
});
test('il report carica tutte le 1201 visite oltre i limiti di una singola pagina',async()=>{
  const source=Array.from({length:1201},(_,index)=>visit(String(index+1).padStart(6,'0'),'2027-01-01'));
  const cursors=[];
  const result=await collectReportVisits(async cursor=>{cursors.push(cursor);const start=cursor?source.findIndex(v=>v.id===cursor)+1:0;return source.slice(start,start+500);});
  assert.equal(result.length,1201);assert.equal(new Set(result.map(v=>v.id)).size,1201);assert.deepEqual(cursors,[null,'000500','001000']);
});
test('un errore di rete o una pagina ripetuta impediscono un report parziale',async()=>{
  const page=Array.from({length:500},(_,index)=>visit(String(index+1).padStart(6,'0')));
  let calls=0;await assert.rejects(()=>collectReportVisits(async()=>{if(calls++)throw new Error('Rete interrotta');return page;}),/Rete interrotta/);
  await assert.rejects(()=>collectReportVisits(async()=>page),/incompleto/);
});
test('un account senza visite produce un report vuoto valido',async()=>{assert.deepEqual(await collectReportVisits(async()=>[]),[]);});
