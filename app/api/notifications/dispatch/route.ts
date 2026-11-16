import { timingSafeEqual } from 'node:crypto';
import { pushAdmin, pushConfiguration, sendPush } from '../../../../lib/push-server';
import { notificationPayload } from '../../../../lib/push-validation';

export const runtime='nodejs';
export const maxDuration=60;
const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request) {
  const secret=process.env.PUSH_CRON_SECRET;
  if(!secret||secret.length<32)return reply({error:'Invio non configurato.'},503);
  const supplied=request.headers.get('authorization')||'',expected=`Bearer ${secret}`;
  if(Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return reply({error:'Non autorizzato.'},401);
  if(!pushConfiguration()||!process.env.SUPABASE_SECRET_KEY)return reply({error:'Invio non configurato.'},503);
  try{
    const db=pushAdmin();
    const {data,error}=await db.rpc('claim_visilab_reminders',{p_limit:20});
    if(error)return reply({error:'Archivio avvisi non disponibile.'},503);
    const jobs=(data||[]) as {id:string}[];
    let accepted=0,failed=0,cancelled=0;
    for(let start=0;start<jobs.length;start+=5){
      await Promise.all(jobs.slice(start,start+5).map(async job=>{
        const {data:prepared,error:prepareError}=await db.rpc('prepare_visilab_reminder',{p_id:job.id});
        if(prepareError){failed++;return;}
        if(!prepared){cancelled++;return;}
        if(prepared.vapidPublicKey!==process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY){
          await db.from('push_deliveries').update({state:'failed',finished_at:new Date().toISOString()}).eq('id',job.id);failed++;return;
        }
        let result:{ok:boolean;status:number;expired:boolean};
        try{result=await sendPush(prepared,notificationPayload(prepared.appointmentId,prepared.reminderAt));}
        catch{result={ok:false,status:0,expired:false};}
        const {error:saveError}=await db.from('push_deliveries').update({state:result.ok?'sent':'failed',provider_status:result.status||null,finished_at:new Date().toISOString()}).eq('id',job.id).eq('state','sending');
        if(result.expired)await db.from('push_subscriptions').delete().eq('id',prepared.subscriptionId);
        if(result.ok&&!saveError)accepted++;else failed++;
      }));
    }
    return reply({claimed:jobs.length,accepted,failed,cancelled});
  }catch{return reply({error:'Servizio avvisi non disponibile.'},503);}
}
