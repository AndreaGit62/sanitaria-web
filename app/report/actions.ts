'use server';
import { loadVisitReport, ReportError } from '../../lib/report-data';
import type { VisitReportData } from '../../lib/visit-report';

export async function getVisitReport():Promise<{data:VisitReportData;error?:never}|{error:string;data?:never}>{
  try{return {data:await loadVisitReport()};}
  catch(error){return {error:error instanceof ReportError?error.message:'Il report non è disponibile. Controlla la connessione e riprova.'};}
}
