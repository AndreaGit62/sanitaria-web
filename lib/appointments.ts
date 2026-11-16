import { Temporal } from '@js-temporal/polyfill';

export function reminderEpoch(value:string):number {
  try{return Temporal.PlainDateTime.from(value).toZonedDateTime('Europe/Rome',{disambiguation:'reject'}).epochMilliseconds;}
  catch{throw new Error('Questo orario del promemoria non esiste o è ambiguo per il cambio dell’ora. Scegli un altro orario.');}
}
export const specialties = ['Cardiologia', 'Laboratorio', 'Oculistica', 'Dermatologia', 'Altra visita'] as const;
export type Visit = {
  id: string; title: string; specialty: string; hospital: string; date: string;
  time: string; doctor: string; notes: string; reminder: string; done: boolean; version?: number;
  bookingStatus?: 'pending' | 'confirmed';
};
export type VisitInput = Omit<Visit, 'id' | 'version'>;
export const validId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function parseVisit(value: unknown): VisitInput {
  if (!value || typeof value !== 'object') throw new Error('Appuntamento non valido.');
  const v = value as Record<string, unknown>;
  const field = (key: string, max: number, required = false) => {
    if (typeof v[key] !== 'string') throw new Error(`Campo ${key} non valido.`);
    const result = v[key].trim();
    if (result.length > max || (required && !result)) throw new Error('Controlla i campi della visita: nome e struttura sono obbligatori.');
    return result;
  };
  if (v.bookingStatus !== undefined && v.bookingStatus !== 'pending' && v.bookingStatus !== 'confirmed') throw new Error('Stato di prenotazione non valido.');
  const requestedPending=v.bookingStatus==='pending';
  const date = field('date', 10), time = field('time', 5), reminder = field('reminder', 16);
  const hospital=field('hospital',150);
  const validDate = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '1900-01-01' || s > '2100-12-31') return false;
    const parsed = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === s;
  };
  const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if ((date&&!validDate(date)) || (time&&!validTime(time))) throw new Error('Inserisci data e ora valide (anni 1900–2100).');
  const bookingStatus=requestedPending && (!date||!hospital) ? 'pending' : 'confirmed';
  if(bookingStatus==='confirmed'&&(!date||!hospital))throw new Error('Per confermare la visita inserisci data e struttura.');
  if (reminder && (reminder.length !== 16 || reminder[10] !== 'T' || !validDate(reminder.slice(0,10)) || !validTime(reminder.slice(11)))) throw new Error('Data del promemoria non valida.');
  if(reminder&&bookingStatus==='pending')throw new Error('Imposta il promemoria dopo aver confermato data e struttura.');
  if(reminder)reminderEpoch(reminder);
  if (reminder && reminder >= `${date}T${time||'00:00'}`) throw new Error(time?'Il promemoria deve precedere l’appuntamento.':'Senza un orario, il promemoria deve precedere il giorno della visita.');
  const specialty = field('specialty', 30, true);
  if (!(specialties as readonly string[]).includes(specialty) || typeof v.done !== 'boolean') throw new Error('Specialità o stato della visita non validi.');
  return { title: field('title',120,true), hospital, doctor:field('doctor',150), notes:field('notes',2000), date, time, reminder, specialty, done:bookingStatus==='pending'?false:v.done, bookingStatus };
}

export function fromRow(row: Record<string, unknown>): Visit {
  return {
    id: String(row.id), title:String(row.title), specialty:String(row.specialty), hospital:String(row.hospital),
    date:row.date ? String(row.date) : '', time:row.time ? String(row.time).slice(0,5) : '', doctor:String(row.doctor), notes:String(row.notes),
    reminder:row.reminder ? String(row.reminder).slice(0,16) : '', done:row.done === true, version:Number(row.version),
    bookingStatus:row.booking_status==='pending'?'pending':'confirmed',
  };
}
