'use client';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, CalendarDays, ChevronRight, RefreshCw } from 'lucide-react';
import type { Visit } from '../lib/appointments';
import { bookingLabel, outcomeLabel, reportDate, reportTimestamp, sortReportVisits, type VisitReportData } from '../lib/visit-report';
import { getVisitReport } from '../app/report/actions';

export default function VisitReport({personal,visits,displayName,onOpen}:{personal:boolean;visits:Visit[];displayName:string;onOpen:(visit:Visit)=>void}){
  const [data,setData]=useState<VisitReportData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [reload,setReload]=useState(0),[exporting,setExporting]=useState(false);
  useEffect(()=>{
    let live=true;setLoading(true);setError('');
    if(!personal){setData({visits:sortReportVisits(visits),displayName,generatedAt:new Date().toISOString()});setLoading(false);return;}
    getVisitReport().then(result=>{if(!live)return;if(result.error)setError(result.error);else setData(result.data!);}).catch(()=>{if(live)setError('Non è stato possibile caricare il report completo. Riprova.');}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[personal,visits,displayName,reload]);
  async function exportDemo(){
    if(!data||exporting)return;setExporting(true);setError('');
    try{
      const [{createVisitReportPdf},regular,bold]=await Promise.all([
        import('../lib/report-pdf'),fetch('/fonts/NotoSans-Regular.ttf'),fetch('/fonts/NotoSans-Bold.ttf'),
      ]);
      if(!regular.ok||!bold.ok)throw new Error('font');
      const encode=(bytes:ArrayBuffer)=>{let raw='';for(const byte of new Uint8Array(bytes))raw+=String.fromCharCode(byte);return btoa(raw);};
      const pdf=createVisitReportPdf(data,{regular:encode(await regular.arrayBuffer()),bold:encode(await bold.arrayBuffer())});
      const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'})),anchor=document.createElement('a');
      anchor.href=url;anchor.download='visilab-visite-demo.pdf';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch{setError('Esportazione non riuscita. Controlla la connessione e riprova.');}finally{setExporting(false);}
  }
  return <section className="panel visit-report" aria-labelledby="report-title">
    <div className="section-heading report-heading"><div><h2 id="report-title">Tutte le visite</h2><p>In ordine di data, con la prenotazione sempre visibile.</p></div>
      {personal?<a className={`button primary ${loading||error?'report-export-disabled':''}`} aria-disabled={loading||Boolean(error)} href={loading||error?undefined:'/api/report/pdf'} target="_blank" rel="noopener noreferrer"><ArrowDownToLine size={18}/>Esporta PDF</a>:<button className="button primary" disabled={loading||exporting||Boolean(error)} onClick={()=>void exportDemo()}><ArrowDownToLine size={18}/>{exporting?'Preparazione…':'Esporta PDF'}</button>}
    </div>
    {loading?<p className="report-message" role="status">Caricamento di tutte le visite…</p>:error?<div className="report-message"><p className="error" role="alert">{error}</p><button className="button subtle" onClick={()=>setReload(value=>value+1)}><RefreshCw size={16}/>Riprova</button></div>:data&&<>
      <div className="report-context"><span><strong>{data.visits.length}</strong> {data.visits.length===1?'visita':'visite'} · {data.displayName}</span><small>Aggiornato il {reportTimestamp(data.generatedAt)}</small></div>
      {data.visits.length===0?<div className="empty"><CalendarDays/><h3>Nessuna visita da riportare</h3><p>Le visite che inserirai compariranno qui.</p></div>:<>
        <div className="report-columns" aria-hidden="true"><span>Data e ora</span><span>Visita / prestazione</span><span>Struttura</span><span>Prenotazione / esito</span><span/></div>
        <ol className="report-visits">{data.visits.map(visit=><li key={visit.id}><button className="report-visit" onClick={()=>onOpen(visit)} aria-label={`Apri riepilogo: ${visit.title}, ${reportDate(visit.date)}, ${bookingLabel(visit)}`}>
          <span className="report-when"><strong>{reportDate(visit.date)}</strong><small>{visit.time||'Orario da definire'}</small>{visit.bookingStatus==='pending'&&visit.date&&<small>Data indicativa</small>}</span>
          <span className="report-description"><strong>{visit.title}</strong><small>{visit.specialty}</small></span>
          <span className="report-hospital">{visit.hospital||'Struttura da scegliere'}</span>
          <span className="report-booking"><span className={`report-badge ${visit.bookingStatus==='pending'?'pending':''}`}>{bookingLabel(visit)}</span><small>{outcomeLabel(visit)}</small></span><ChevronRight size={17} aria-hidden="true"/>
        </button></li>)}</ol>
      </>}
      <p className="report-note">Le visite senza data sono in fondo all’elenco. Il PDF personale viene aggiornato al momento dell’esportazione.</p>
    </>}
  </section>;
}
