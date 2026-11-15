'use client';

import { CalendarDays, Check, ChevronRight, Clock3, MapPin, Paperclip } from 'lucide-react';
import type { Visit } from '../lib/appointments';

type Props = {
  visit: Visit;
  compact?: boolean;
  attachmentCount?: number;
  onOpen: () => void;
  onCalendar: () => void;
  onAttachments: () => void;
};

export default function AppointmentCard({visit:v,compact=false,attachmentCount=0,onOpen,onCalendar,onAttachments}:Props) {
  const date=new Date(v.date+'T12:00:00');
  const attachmentLabel=`${attachmentCount} ${attachmentCount===1?'documento allegato':'documenti allegati'}`;
  return <article className={`visit visit-clickable ${v.done?'done':''}`}>
    <button type="button" className="visit-open" aria-label={`Apri appuntamento: ${v.title}`} onClick={onOpen}/>
    <div className="date-tile"><span>{date.toLocaleDateString('it-IT',{month:'short'}).replace('.','')}</span><strong>{date.toLocaleDateString('it-IT',{day:'2-digit'})}</strong></div>
    <div className="visit-content">
      <div className="visit-heading"><span className="visit-title">{v.title}</span><span className={`tag ${v.specialty==='Laboratorio'?'purple':v.specialty==='Oculistica'?'blue':''}`}>{v.specialty}</span></div>
      <p><MapPin size={14}/>{v.hospital}</p>
      <div className="visit-meta"><span><Clock3 size={13}/>{v.time}</span>{!compact&&<span>{v.doctor}</span>}</div>
    </div>
    <div className="visit-actions">
      {attachmentCount>0&&<button type="button" className="visit-attachments" aria-label={`Apri ${attachmentLabel} di ${v.title}`} title={attachmentLabel} onClick={onAttachments}><Paperclip size={16}/><span>{attachmentCount}</span></button>}
      {v.done?<span className="status"><Check size={14}/> Effettuata</span>:<button type="button" className="icon-button reminder-icon" aria-label={`Esporta ${v.title} nel calendario`} title="Scarica evento per Calendario" onClick={onCalendar}><CalendarDays size={18}/></button>}
    </div>
    <ChevronRight className="visit-chevron" size={19} aria-hidden="true"/>
  </article>;
}
