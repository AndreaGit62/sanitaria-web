import 'server-only';
import { createSupabase } from './supabase/server';
import { fromRow } from './appointments';
import { collectReportVisits, type VisitReportData } from './visit-report';

export class ReportError extends Error {
  constructor(message:string,public status:number){super(message);}
}

export async function loadVisitReport():Promise<VisitReportData>{
  const db=await createSupabase();
  const {data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw new ReportError('Sessione scaduta. Accedi di nuovo per aprire il report.',401);
  const [profile,visits]=await Promise.all([
    db.from('profiles').select('display_name').eq('id',user.id).maybeSingle(),
    collectReportVisits(async cursor=>{
      let query=db.from('appointments').select('*').eq('user_id',user.id).order('id',{ascending:true}).limit(500);
      if(cursor)query=query.gt('id',cursor);
      const {data,error}=await query;
      if(error)throw new ReportError('Non è stato possibile caricare tutte le visite. Riprova.',503);
      return (data||[]).map(fromRow);
    }),
  ]);
  return {visits,displayName:profile.data?.display_name||String(user.user_metadata.name||'Utente VisiLab'),generatedAt:new Date().toISOString()};
}
