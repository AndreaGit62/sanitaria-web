'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, ChevronRight, RefreshCw } from 'lucide-react';
import type { Visit } from '../lib/appointments';
import { bookingLabel, outcomeLabel, reportDate, reportTimestamp, sortReportVisits, type VisitReportData } from '../lib/visit-report';
import { getVisitReport } from '../app/report/actions';
import ReportExport from './report-export';
import { fetchReportPdf } from '../lib/report-export';

export default function VisitReport({personal,visits,displayName,onOpen}:{personal:boolean;visits:Visit[];displayName:string;onOpen:(visit:Visit)=>void}){
  const [data,setData]=useState<VisitReportData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let live=true;setLoading(true);setError('');
    if(!personal){setData({visits:sortReportVisits(visits),displayName,generatedAt:new Date().toISOString()});setLoading(false);return;}
    getVisitReport().then(result=>{if(!live)return;if(result.error)setError(result.error);else setData(result.data!);}).catch(()=>{if(live)setError('Non è stato possibile caricare il report completo. Riprova.');}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[personal,visits,displayName,reload]);
  async function prepareDemo(signal:AbortSignal):Promise<File>{
    if(!data)throw new Error('Il report non è ancora disponibile.');
    const [{createVisitReportPdf},regular,bold]=await Promise.all([
      import('../lib/report-pdf'),fetch('/fonts/NotoSans-Regular.ttf',{signal}),fetch('/fonts/NotoSans-Bold.ttf',{signal}),
    ]);
    if(!regular.ok||!bold.ok)throw new Error('Non è stato possibile preparare il PDF. Riprova.');
    const encode=(bytes:ArrayBuffer)=>{let raw='';for(const byte of new Uint8Array(bytes))raw+=String.fromCharCode(byte);return btoa(raw);};
    const pdf=createVisitReportPdf(data,{regular:encode(await regular.arrayBuffer()),bold:encode(await bold.arrayBuffer())});
    return new File([pdf],'visilab-visite-demo.pdf',{type:'application/pdf'});
  }
  return <section className="panel visit-report" aria-labelledby="report-title">
    <div className="section-heading report-heading"><div><h2 id="report-title">Tutte le visite</h2><p>In ordine di data, con la prenotazione sempre visibile.</p></div>
      <ReportExport disabled={loading||Boolean(error)} prepareFile={personal?fetchReportPdf:prepareDemo}/>
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
