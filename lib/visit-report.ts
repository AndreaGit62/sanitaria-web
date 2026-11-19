import type { Visit } from './appointments';

export type VisitReportData={visits:Visit[];displayName:string;generatedAt:string};

export function sortReportVisits(visits:readonly Visit[]):Visit[]{
  return [...visits].sort((a,b)=>{
    const dates=(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31');
    return dates||(a.time||'99:99').localeCompare(b.time||'99:99')||a.title.localeCompare(b.title,'it')||a.id.localeCompare(b.id);
  });
}
export const bookingLabel=(visit:Visit)=>visit.bookingStatus==='pending'?'Da prenotare':'Prenotata';
export const outcomeLabel=(visit:Visit)=>visit.done?'Effettuata':visit.bookingStatus==='pending'?'Da organizzare':'Da effettuare';
export function reportDate(value:string){return value?value.split('-').reverse().join('/'):'Da definire';}
export function reportTimestamp(value:string){return new Date(value).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}

// Keyset pagination keeps older visits in the report even when the agenda shows only 500.
export async function collectReportVisits(fetchPage:(cursor:string|null)=>Promise<Visit[]>,pageSize=500):Promise<Visit[]>{
  const all:Visit[]=[];let cursor:string|null=null;
  while(true){
    const page=await fetchPage(cursor);
    if(!page.length)break;
    const next=page[page.length-1].id;
    if(!next||(cursor!==null&&next<=cursor))throw new Error('Caricamento del report incompleto.');
    all.push(...page);
    if(page.length<pageSize)break;
    cursor=next;
  }
  return sortReportVisits(all);
}
