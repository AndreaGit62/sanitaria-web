import test from 'node:test';
import assert from 'node:assert/strict';
import {canShareReportFile,fetchReportPdf,isAppleMobileBrowser,shareReportFile} from '../lib/report-export.ts';
const file=new File(['%PDF-1.3\nTest sintetico'],'visilab-visite.pdf',{type:'application/pdf'});

test('riconosce iPhone e iPad anche con user-agent desktop',()=>{
  assert.ok(isAppleMobileBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'));
  assert.ok(isAppleMobileBrowser('Mozilla/5.0 (iPad; CPU OS 18_0)'));
  assert.ok(isAppleMobileBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X)',5));
  assert.equal(isAppleMobileBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X)',0),false);
  assert.equal(isAppleMobileBrowser('Mozilla/5.0 (Windows NT 10.0)',5),false);
});
test('carica il PDF in memoria con la sessione corrente, senza navigare',async()=>{
  const controller=new AbortController();let options;
  const result=await fetchReportPdf(controller.signal,async(url,init)=>{assert.equal(url,'/api/report/pdf');options=init;return new Response(await file.arrayBuffer(),{headers:{'Content-Type':'application/pdf'}});});
  assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.signal,controller.signal);
  assert.equal(result.name,'visilab-visite.pdf');assert.equal(result.type,'application/pdf');assert.ok((await result.text()).startsWith('%PDF-'));
});
test('sessione scaduta e risposte non PDF non avviano aperture o falsi download',async()=>{
  const signal=new AbortController().signal;
  await assert.rejects(()=>fetchReportPdf(signal,async()=>new Response('{}',{status:401})),/Sessione scaduta/);
  await assert.rejects(()=>fetchReportPdf(signal,async()=>new Response('<html>Accedi</html>',{headers:{'Content-Type':'text/html'}})),/PDF valido/);
  await assert.rejects(()=>fetchReportPdf(signal,async()=>new Response('not-a-pdf',{headers:{'Content-Type':'application/pdf'}})),/incompleto/);
});
test('la preparazione annullata non lascia un PDF da aprire',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>fetchReportPdf(controller.signal,async()=>new Response('%PDF-1.3',{headers:{'Content-Type':'application/pdf'}})),{name:'AbortError'});
});
test('il file viene condiviso subito dal nuovo tocco, senza attese asincrone intermedie',async()=>{
  let called=false;
  const api={canShare:({files})=>files[0]===file,share:args=>{called=true;assert.equal(args.files[0],file);return Promise.resolve();}};
  const promise=shareReportFile(api,file);assert.equal(called,true);await promise;
  assert.equal(canShareReportFile({canShare:()=>{throw new Error('Non disponibile');},share:()=>Promise.resolve()},file),false);
});
test('annullamento e indisponibilità della condivisione sono gestibili senza cambiare pagina',async()=>{
  const api={canShare:()=>true,share:()=>Promise.reject(new DOMException('Annullato','AbortError'))};
  await assert.rejects(()=>shareReportFile(api,file),{name:'AbortError'});
  await assert.rejects(()=>shareReportFile({...api,canShare:()=>false},file),/non consente/);
  await assert.rejects(()=>shareReportFile({...api,share:()=>{throw new Error('Indisponibile');}},file),/Indisponibile/);
});
