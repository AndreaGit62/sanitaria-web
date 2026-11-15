export const DOCUMENT_BUCKET = 'medical-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export type PrivateDocument = {
  id: string; name: string; mime: 'application/pdf' | 'image/jpeg'; size: number;
  createdAt: string; status: 'pending' | 'ready'; appointmentId: string | null;
  appointmentTitle?: string; appointmentDate?: string; version: number;
};
export function parseDocumentMetadata(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Documento non valido.');
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(v.name)) throw new Error('Nome file non valido o troppo lungo (massimo 180 caratteri).');
  if (v.mime !== 'application/pdf' && v.mime !== 'image/jpeg') throw new Error('Scegli un file PDF o JPG.');
  if (typeof v.size !== 'number' || !Number.isSafeInteger(v.size) || v.size < 1 || v.size > MAX_DOCUMENT_BYTES) throw new Error('Il file deve avere dimensione maggiore di zero e non superare 10 MB.');
  if (!(v.mime === 'application/pdf' ? /\.pdf$/i : /\.jpe?g$/i).test(v.name)) throw new Error('Estensione e formato del documento non corrispondono.');
  return {name:v.name.trim(),mime:v.mime,size:v.size};
}
export function guessDocumentMime(name: string, reported: string) {
  if (reported) return reported;
  return /\.pdf$/i.test(name) ? 'application/pdf' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : '';
}
export function validDocumentHeader(bytes: Uint8Array, mime: string) {
  return mime === 'application/pdf'
    ? bytes.length >= 8 && String.fromCharCode(...bytes.slice(0,5)) === '%PDF-'
    : mime === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
export function documentFromRow(row: Record<string, unknown>): PrivateDocument {
  const appointment = row.appointment && typeof row.appointment === 'object' && !Array.isArray(row.appointment)
    ? row.appointment as Record<string,unknown> : null;
  return {
    id:String(row.id),name:String(row.original_name),mime:row.mime_type as PrivateDocument['mime'],size:Number(row.size),
    createdAt:String(row.created_at),status:row.status as PrivateDocument['status'],version:Number(row.version),
    appointmentId:row.appointment_id ? String(row.appointment_id) : null,
    appointmentTitle:appointment ? String(appointment.title) : undefined,
    appointmentDate:appointment ? String(appointment.date) : undefined,
  };
}
