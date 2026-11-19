'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, Check, FileText, RefreshCw, Share2, X } from 'lucide-react';
import { canShareReportFile, isAppleMobileBrowser, shareReportFile } from '../lib/report-export';

export default function ReportExport({disabled,prepareFile}:{disabled:boolean;prepareFile:(signal:AbortSignal)=>Promise<File>}){
  const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[error,setError]=useState('');
  const [sharing,setSharing]=useState(false),[message,setMessage]=useState(''),[url,setUrl]=useState('');
  const [ios,setIos]=useState(false),[canShare,setCanShare]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const request=useRef<AbortController|null>(null),sequence=useRef(0);
  useEffect(()=>{setIos(isAppleMobileBrowser(navigator.userAgent,navigator.maxTouchPoints));return()=>{sequence.current++;request.current?.abort();};},[]);
  useEffect(()=>{
    if(!open)return;
    const element=dialog.current;if(element&&!element.open)element.showModal();
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{element?.close();document.body.style.overflow=previous;trigger.current?.focus();};
  },[open]);
  useEffect(()=>{
    setCanShare(Boolean(file&&canShareReportFile(navigator,file)));
    if(!file||ios){setUrl('');return;}
    const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);
    return()=>URL.revokeObjectURL(objectUrl);
  },[file,ios]);
  function close(){sequence.current++;request.current?.abort();setOpen(false);setFile(null);setError('');setMessage('');setSharing(false);}
  async function prepare(){
    const ticket=++sequence.current;request.current?.abort();
    const controller=new AbortController();request.current=controller;
    setOpen(true);setFile(null);setError('');setMessage('');setSharing(false);
    try{const pdf=await prepareFile(controller.signal);if(sequence.current===ticket&&!controller.signal.aborted)setFile(pdf);}
    catch(cause){if(sequence.current===ticket&&!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Preparazione non riuscita. Riprova.');}
  }
  function share(){
    if(!file||sharing)return;const ticket=sequence.current;setSharing(true);setMessage('');setError('');
    // This call runs synchronously from the button tap, with an already prepared File.
    shareReportFile(navigator,file).then(()=>{if(sequence.current===ticket)setMessage('Operazione completata.');}).catch(cause=>{
      if(sequence.current!==ticket)return;
      if(cause instanceof Error&&cause.name==='AbortError')setMessage('Operazione annullata. Puoi riprovare oppure tornare al report.');
      else setError('Non è stato possibile aprire il salvataggio. Riprova; il report resta disponibile.');
    }).finally(()=>{if(sequence.current===ticket)setSharing(false);});
  }
  return <>
    <button ref={trigger} type="button" className="button primary" disabled={disabled} onClick={()=>void prepare()}><ArrowDownToLine size={18}/>Esporta PDF</button>
    {open&&<dialog ref={dialog} className="modal report-export-dialog" aria-labelledby="export-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{
      if(event.target!==event.currentTarget)return;const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();
    }}>
      <div className="modal-heading"><div><span className="eyebrow">IL TUO REPORT</span><h2 id="export-title">Salva il PDF</h2></div><button type="button" autoFocus className="icon-button" aria-label="Chiudi esportazione PDF" onClick={close}><X/></button></div>
      <div className="report-export-body">
        {!file&&!error&&<p className="report-export-progress" role="status"><RefreshCw size={20}/>Preparazione del report…</p>}
        {file&&<><div className="report-export-file"><FileText size={28}/><div><strong>{file.name}</strong><small>PDF · {Math.max(1,Math.round(file.size/1024))} KB</small></div></div>
          {ios?<p>Tocca <strong>Salva o condividi PDF</strong>, poi scegli <strong>Salva su File</strong>. Al termine potrai tornare al report senza uscire da VisiLab.</p>:<p>Il PDF è pronto. Puoi scaricarlo sul dispositivo e tornare al report.</p>}
          <div className="report-export-actions">
            {canShare&&<button type="button" className={`button ${ios?'primary':'subtle'}`} disabled={sharing} onClick={share}><Share2 size={18}/>{ios?'Salva o condividi PDF':'Condividi PDF'}</button>}
            {!ios&&url&&<a className="button primary" href={url} download={file.name}><ArrowDownToLine size={18}/>Scarica PDF</a>}
          </div>
          {ios&&!canShare&&<p className="error" role="alert">Il salvataggio dei file non è disponibile in questa modalità. Puoi riprovare da Safari o dal PC; usa “Torna al report” per continuare in VisiLab.</p>}
        </>}
        {error&&<p className="error" role="alert">{error}</p>}
        {error&&!file&&<button type="button" className="button subtle" onClick={()=>void prepare()}><RefreshCw size={16}/>Riprova</button>}
        {message&&<p className="report-export-feedback" role="status"><Check size={17}/>{message}</p>}
      </div>
      <div className="report-export-footer"><button type="button" className="button subtle" onClick={close}>Torna al report</button></div>
    </dialog>}
  </>;
}
