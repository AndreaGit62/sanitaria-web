'use client';

import { Bell, CalendarDays, Check, Clock3, MapPin, Paperclip, Pencil, Stethoscope, UserRound } from 'lucide-react';
import type { Visit } from '../lib/appointments';

type Props={visit:Visit;personal:boolean;attachmentCount:number;documentError:string;onAttachments:()=>void;onEdit:()=>void;onClose:()=>void};
const dateLabel=(value:string)=>value?new Date(value+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Data da definire';

export default function AppointmentSummary({visit,personal,attachmentCount,documentError,onAttachments,onEdit,onClose}:Props){
  const pending=visit.bookingStatus==='pending';
  return <div className="appointment-summary">
    <div className="summary-intro"><span className={`summary-status ${pending?'pending':visit.done?'done':'confirmed'}`}>{visit.done&&<Check size={14}/>} {pending?'Da prenotare':visit.done?'Effettuata':'Confermata'}</span><h3>{visit.title}</h3>{pending&&<p>Completa data e struttura da Modifica quando avrai confermato la prenotazione.</p>}</div>
    <dl className="summary-data">
      <div><dt><CalendarDays size={16}/>{pending&&visit.date?'Data indicativa':'Data'}</dt><dd>{dateLabel(visit.date)}</dd></div>
      <div><dt><Clock3 size={16}/>Orario</dt><dd>{visit.time||'Orario da definire'}</dd></div>
      <div className="summary-wide"><dt><MapPin size={16}/>Struttura / ospedale</dt><dd>{visit.hospital||'Struttura da scegliere'}</dd></div>
      <div><dt><Stethoscope size={16}/>Specialità</dt><dd>{visit.specialty}</dd></div>
      <div><dt><UserRound size={16}/>Medico o reparto</dt><dd>{visit.doctor||'Non indicato'}</dd></div>
      <div className="summary-wide"><dt><Bell size={16}/>Promemoria</dt><dd>{visit.reminder?`${dateLabel(visit.reminder.slice(0,10))} alle ${visit.reminder.slice(11,16)}`:'Nessun promemoria impostato'}</dd>{visit.done&&visit.reminder&&<p>Avviso disattivato: la visita è già effettuata.</p>}</div>
    </dl>
    <section className="summary-notes"><h4>Note</h4><p className={visit.notes?'':'summary-muted'}>{visit.notes||'Nessuna nota aggiunta.'}</p></section>
    {personal&&<section className="summary-documents"><h4>Documenti allegati</h4>{documentError?<p className="error" role="alert">{documentError}</p>:attachmentCount>0?<button type="button" className="appointment-attachments" onClick={onAttachments}><Paperclip size={22}/><span><strong>{attachmentCount} {attachmentCount===1?'documento allegato':'documenti allegati'}</strong><small>Apri l’elenco dei PDF e delle immagini</small></span></button>:<p className="summary-muted">Nessun documento allegato. Puoi aggiungerli da Modifica.</p>}</section>}
    <p className="summary-timezone">Date e orari riferiti all’Italia.</p>
    <div className="modal-footer summary-footer"><button type="button" className="button subtle" onClick={onClose}>Chiudi</button><button type="button" className="button primary summary-edit" onClick={onEdit}><Pencil size={17}/>Modifica</button></div>
  </div>;
}
