import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadVisitReport, ReportError } from '../../../../lib/report-data';
import { createVisitReportPdf } from '../../../../lib/report-pdf';

export const runtime='nodejs';
export const maxDuration=60;
export async function GET(){
  try{
    // Authenticate before reading data or generating the file. Query scope is always the current user.
    const data=await loadVisitReport();
    const [regular,bold]=await Promise.all([
      readFile(join(process.cwd(),'public/fonts/NotoSans-Regular.ttf')),
      readFile(join(process.cwd(),'public/fonts/NotoSans-Bold.ttf')),
    ]);
    const bytes=createVisitReportPdf(data,{regular:regular.toString('base64'),bold:bold.toString('base64')});
    return new Response(bytes,{headers:{
      'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="visilab-visite.pdf"',
      'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff',
    }});
  }catch(error){return Response.json({error:error instanceof ReportError?error.message:'PDF non disponibile. Riprova tra poco.'},{status:error instanceof ReportError?error.status:503,headers:{'Cache-Control':'private, no-store'}});}
}
