'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { FileText, Upload, Trash2, ArrowDownToLine, Search, FolderOpen, LoaderCircle } from 'lucide-react';
import { prepareDocument, completeDocument, linkDocument, openDocument, deleteDocument } from '../app/documents/actions';
import { DOCUMENT_BUCKET, guessDocumentMime, parseDocumentMetadata, validDocumentHeader, type PrivateDocument } from '../lib/documents';
import type { Visit } from '../lib/appointments';

type Props = {
  initialDocs:PrivateDocument[]; visits:Visit[]; inputRef:RefObject<HTMLInputElement|null>; loadError:string;
  initialFilter?:string; truncated?:boolean; mode?:'archive'|'attachments'|'upload';
  onBusyChange?:(busy:boolean)=>void; onShowAttachments?:()=>void;
};
const dateLabel=(s:string)=>new Date(s).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});

export default function DocumentArchive({initialDocs,visits,inputRef,loadError,initialFilter='all',truncated=false,mode='archive',onBusyChange,onShowAttachments}:Props) {
  const router=useRouter();
  const [docs,setDocs]=useState(initialDocs);
  const [busy,setBusy]=useState('');
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState(initialFilter);
  const [uploadVisit,setUploadVisit]=useState(initialFilter==='all'||initialFilter==='none'?'':initialFilter);
  const [fallback,setFallback]=useState<{url:string;name:string}|null>(null);
  const fallbackTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>setDocs(initialDocs),[initialDocs]);
  useEffect(()=>{setFilter(initialFilter);setUploadVisit(initialFilter==='all'||initialFilter==='none'?'':initialFilter);},[initialFilter]);
  useEffect(()=>()=>{if(fallbackTimer.current)clearTimeout(fallbackTimer.current);},[]);
  useEffect(()=>{onBusyChange?.(Boolean(busy));return()=>onBusyChange?.(false);},[busy,onBusyChange]);
  function put(doc:PrivateDocument){setDocs(prev=>[doc,...prev.filter(d=>d.id!==doc.id)]);}
  async function upload(files:FileList|null) {
    if (!files || busy) return;
    setError('');setNotice('');
    const selected=Array.from(files);
    if (selected.length>5) {setError('Scegli al massimo 5 documenti alla volta.');if(inputRef.current)inputRef.current.value='';return;}
    setBusy('upload');
    let successful=0;
    const failures:string[]=[];
    try {
      const storage=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}).storage.from(DOCUMENT_BUCKET);
      for (const [index,file] of selected.entries()) {
        setProgress(`Documento ${index+1} di ${selected.length}: ${file.name}`);
        try {
          const mime=guessDocumentMime(file.name,file.type);
          const metadata=parseDocumentMetadata({name:file.name,mime,size:file.size});
          if(!validDocumentHeader(new Uint8Array(await file.slice(0,8).arrayBuffer()),mime)) throw new Error('Il contenuto del file non corrisponde a un PDF o JPG valido.');
          const prepared=await prepareDocument(metadata,uploadVisit||null);
          if (!prepared.document || !prepared.path || !prepared.token) throw new Error(prepared.error || 'Preparazione non confermata.');
          put(prepared.document);
          // Su iPhone alcuni File non riportano il MIME: assegniamo quello verificato.
          const body=file.slice(0,file.size,mime);
          const sent=await storage.uploadToSignedUrl(prepared.path,prepared.token,body,{contentType:mime,cacheControl:'0',upsert:false});
          if(sent.error) throw new Error('Invio interrotto. Usa “Verifica upload” sulla voce rimasta nell’archivio; se il file manca, rimuovila e riprova.');
          const completed=await completeDocument(prepared.document.id);
          if(!completed.document) throw new Error(completed.error || 'Verifica non confermata.');
          put(completed.document);successful++;
        } catch(cause) {failures.push(`${file.name}: ${cause instanceof Error?cause.message:'Caricamento non confermato.'}`);}
      }
      if(successful)setNotice(`${successful} ${successful===1?'documento salvato':'documenti salvati'} nell’archivio privato.`);
      if(failures.length)setError(failures.join('\n'));
    } catch {setError('Servizio non raggiungibile. Aggiorna l’archivio prima di riprovare.');}
    finally {setBusy('');setProgress('');if(inputRef.current)inputRef.current.value='';router.refresh();}
  }
  async function view(doc:PrivateDocument,download=false) {
    if(busy)return;
    const popup=window.open('about:blank','_blank');
    if(popup)popup.opener=null;
    setBusy(doc.id);setError('');setFallback(null);
    try {
      const result=await openDocument(doc.id,download);
      if(!result.url){popup?.close();setError(result.error || 'Apertura non confermata.');return;}
      if(popup)popup.location.href=result.url;
      else {
        setFallback({url:result.url,name:doc.name});
        if(fallbackTimer.current)clearTimeout(fallbackTimer.current);
        fallbackTimer.current=setTimeout(()=>setFallback(null),60000);
      }
    } catch {popup?.close();setError('Apertura non riuscita. Riprova.');}
    finally {setBusy('');}
  }
  async function associate(doc:PrivateDocument,appointmentId:string) {
    if(busy)return;setBusy(doc.id);setError('');setNotice('');
    try {
      const result=await linkDocument(doc.id,appointmentId||null,doc.version);
      if(!result.document){setError(result.error || 'Collegamento non confermato.');return;}
      put(result.document);setNotice(appointmentId?'Documento collegato alla visita.':'Collegamento alla visita rimosso.');
    } catch {setError('Collegamento non confermato. Aggiorna l’archivio.');}
    finally {setBusy('');router.refresh();}
  }
  async function verify(doc:PrivateDocument) {
    if(busy)return;setBusy(doc.id);setError('');setNotice('');
    try {const result=await completeDocument(doc.id);if(!result.document)setError(result.error || 'Verifica non confermata.');else{put(result.document);setNotice('Documento verificato e disponibile.');}}
    catch {setError('Verifica interrotta. Riprova.');}
    finally {setBusy('');router.refresh();}
  }
  async function remove(doc:PrivateDocument) {
    if(busy||!window.confirm(`Eliminare “${doc.name}” dall’archivio?`))return;
    setBusy(doc.id);setError('');setNotice('');
    try {
      const result=await deleteDocument(doc.id);
      if(result.error){setError(result.error);return;}
      if(result.id!==doc.id){setError('Eliminazione non confermata.');return;}
      setDocs(prev=>prev.filter(d=>d.id!==doc.id));setNotice('Documento eliminato.');
    } catch {setError('Eliminazione non confermata. Aggiorna l’archivio.');}
    finally {setBusy('');router.refresh();}
  }
  const visible=docs.filter(d=>(mode!=='attachments'||d.status==='ready')&&d.name.toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it'))&&(filter==='all'||(filter==='none'?!d.appointmentId:d.appointmentId===filter)));
  const linkedVisit=visits.find(v=>v.id===initialFilter);
  return <section className="panel private-documents" aria-busy={Boolean(busy)}>
    {mode==='archive'&&<div className="section-heading"><div><h2>Il tuo archivio privato</h2><p>Documenti PDF e JPG, disponibili anche da iPhone</p></div><span className="tag">{docs.filter(d=>d.status==='ready').length} file</span></div>}
    {mode==='attachments'&&<p className="attachment-list-summary">{visible.length} {visible.length===1?'file caricato':'file caricati'}</p>}
    {loadError&&<p className="error document-alert" role="alert">{loadError}</p>}
    {truncated&&<p className="info-box">Sono mostrati i 500 documenti più recenti.</p>}
    {mode!=='attachments'&&<div className="document-upload">{mode==='archive'?<label>Collega i nuovi file a una visita<select value={uploadVisit} onChange={e=>setUploadVisit(e.target.value)} disabled={Boolean(busy)||Boolean(loadError)}><option value="">Nessuna visita</option>{visits.map(v=><option value={v.id} key={v.id}>{v.title} · {dateLabel(v.date+'T12:00:00')}</option>)}</select></label>:<p className="document-upload-instructions">Scegli i documenti da caricare. Verranno collegati automaticamente a <strong>{linkedVisit?.title||'questa visita'}</strong>.</p>}<button className="upload-box large" disabled={Boolean(busy)||Boolean(loadError)} onClick={()=>inputRef.current?.click()}><Upload size={28}/><strong>{busy==='upload'?'Caricamento in corso…':'Scegli PDF o JPG'}</strong><span>Fino a 10 MB per file · massimo 5 file alla volta</span></button><input ref={inputRef} className="visually-hidden" tabIndex={-1} type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" multiple disabled={Boolean(busy)||Boolean(loadError)} onChange={e=>void upload(e.target.files)}/></div>}
    {progress&&<p className="document-progress" role="status"><LoaderCircle size={17}/>{progress}</p>}
    {error&&<p className="error document-alert multiline" role="alert">{error}{mode==='upload'&&<><br/>I caricamenti interrotti possono essere verificati o rimossi dalla sezione Documenti.</>}</p>}
    {notice&&<p className="auth-alert success document-alert" role="status">{notice}</p>}
    {mode==='upload'&&notice&&onShowAttachments&&<div className="document-upload-result"><button className="button subtle" disabled={Boolean(busy)} onClick={onShowAttachments}>Visualizza i documenti caricati</button></div>}
    {fallback&&<p className="info-box"><a href={fallback.url} target="_blank" rel="noopener noreferrer">Apri {fallback.name} →</a><br/>Il link scade tra un minuto. Se scade, premi di nuovo Apri o Scarica.</p>}
    {mode==='archive'&&<div className="document-filters"><label className="search"><Search size={17}/><input placeholder="Cerca documento…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filtra documenti per visita" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tutti i documenti</option><option value="none">Senza visita collegata</option>{visits.map(v=><option value={v.id} key={v.id}>{v.title} · {dateLabel(v.date+'T12:00:00')}</option>)}</select></div>}
    {mode!=='upload'&&visible.map(doc=><article className={`private-document-row ${mode==='attachments'?'attachment-list-row':''}`} key={doc.id}><div className="document-summary"><span className="file-icon"><FileText size={23}/></span><div><h3>{doc.name}</h3><p>{doc.mime==='application/pdf'?'PDF':'JPG'} · {(doc.size/1024/1024).toFixed(2)} MB · {dateLabel(doc.createdAt)}</p>{mode==='archive'&&<span className={`document-state ${doc.status==='pending'?'pending':''}`}>{doc.status==='ready'?'Salvato nell’archivio':'Caricamento da completare'}</span>}</div></div><div className="document-controls">{mode==='archive'&&<label>Visita collegata<select aria-label={`Visita collegata a ${doc.name}`} value={doc.appointmentId||''} disabled={Boolean(busy)} onChange={e=>void associate(doc,e.target.value)}><option value="">Nessuna visita</option>{doc.appointmentId&&!visits.some(v=>v.id===doc.appointmentId)&&<option value={doc.appointmentId}>{doc.appointmentTitle||'Visita collegata'}</option>}{visits.map(v=><option value={v.id} key={v.id}>{v.title} · {dateLabel(v.date+'T12:00:00')}</option>)}</select></label>}<div className="document-buttons">{doc.status==='ready'?<><button className="button subtle" disabled={Boolean(busy)} onClick={()=>void view(doc)}>Apri</button><button className="button subtle" disabled={Boolean(busy)} onClick={()=>void view(doc,true)}><ArrowDownToLine size={15}/>Scarica</button></>:<button className="button subtle" disabled={Boolean(busy)} onClick={()=>void verify(doc)}>Verifica upload</button>}{mode==='archive'&&<button className="icon-button danger" disabled={Boolean(busy)} aria-label={`Elimina ${doc.name}`} onClick={()=>void remove(doc)}><Trash2 size={18}/></button>}</div></div></article>)}
    {!loadError&&mode!=='upload'&&visible.length===0&&<div className="empty"><FolderOpen/><h3>{mode==='attachments'?'Nessun documento allegato':docs.length?'Nessun documento trovato':'Un posto per ogni referto'}</h3><p>{mode==='attachments'?'Qui troverai i file caricati per questa visita.':docs.length?'Prova un’altra ricerca o cambia il filtro.':'Carica il primo PDF o JPG e ritrovalo da tutti i tuoi dispositivi.'}</p></div>}
  </section>;
}
