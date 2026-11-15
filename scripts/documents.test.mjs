import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DOCUMENT_BYTES, parseDocumentMetadata, validDocumentHeader, guessDocumentMime, documentFromRow } from '../lib/documents.ts';
const good={name:'Referto di prova.pdf',mime:'application/pdf',size:100};
test('accetta solo metadati PDF/JPG validi e scarta i campi del proprietario',()=>{
  assert.deepEqual(parseDocumentMetadata({...good,user_id:'altro',storage_path:'altro/percorso'}),good);
  assert.equal(parseDocumentMetadata({name:'foto.JPEG',mime:'image/jpeg',size:MAX_DOCUMENT_BYTES}).mime,'image/jpeg');
});
test('rifiuta file vuoti, troppo grandi e dimensioni non intere',()=>{
  for(const size of [0,-1,MAX_DOCUMENT_BYTES+1,1.5,NaN,'100'])assert.throws(()=>parseDocumentMetadata({...good,size}));
});
test('rifiuta nomi con percorsi o caratteri di controllo e tipi inattesi',()=>{
  for(const name of ['','../referto.pdf','cartella\\referto.pdf','nome\nfile.pdf','a'.repeat(181)+'.pdf'])assert.throws(()=>parseDocumentMetadata({...good,name}));
  for(const mime of ['text/html','image/png','image/heic','application/octet-stream'])assert.throws(()=>parseDocumentMetadata({...good,mime}));
  assert.throws(()=>parseDocumentMetadata({...good,name:'file.jpg'}));
});
test('controlla la firma iniziale del contenuto oltre all’estensione',()=>{
  const pdf=new TextEncoder().encode('%PDF-1.4\n');
  const jpg=new Uint8Array([0xff,0xd8,0xff,0xe0]);
  const html=new TextEncoder().encode('<html>non è un PDF');
  assert.ok(validDocumentHeader(pdf,'application/pdf'));
  assert.ok(validDocumentHeader(jpg,'image/jpeg'));
  assert.equal(validDocumentHeader(html,'application/pdf'),false);
  assert.equal(validDocumentHeader(pdf,'image/jpeg'),false);
  assert.equal(validDocumentHeader(new Uint8Array(),'application/pdf'),false);
});
test('rileva il tipo dal nome solo quando il dispositivo non lo specifica',()=>{
  assert.equal(guessDocumentMime('foto.jpg',''),'image/jpeg');
  assert.equal(guessDocumentMime('referto.PDF',''),'application/pdf');
  assert.equal(guessDocumentMime('foto.jpg','image/heic'),'image/heic');
  assert.equal(guessDocumentMime('file.exe',''),'');
});
test('non espone percorsi storage o proprietari nei metadati del componente',()=>{
  const doc=documentFromRow({id:'demo',original_name:good.name,mime_type:good.mime,size:100,created_at:'2026-11-15T12:00:00Z',status:'ready',version:2,appointment_id:'visita',appointment:{title:'Visita demo',date:'2026-11-20'},storage_path:'percorso-privato',user_id:'utente'});
  assert.equal(doc.appointmentTitle,'Visita demo');assert.equal(doc.size,100);assert.equal(doc.version,2);
  assert.equal(Object.hasOwn(doc,'storage_path'),false);assert.equal(Object.hasOwn(doc,'user_id'),false);
});
