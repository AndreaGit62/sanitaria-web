'use server';

import { createSupabase } from '../../lib/supabase/server';
import { validId } from '../../lib/appointments';
import { allowedPushEndpoint, notificationPayload, parsePushDevice } from '../../lib/push-validation';
import { clearPushCookie, pushConfiguration, rememberPushDevice, sendPush } from '../../lib/push-server';

async function session(){
  const db=await createSupabase();
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user)throw new Error('Sessione scaduta. Accedi di nuovo.');
  return {db,user};
}
const failure=(error:unknown)=>({error:error instanceof Error&&error.message.startsWith('Sessione')?error.message:'Notifiche non disponibili. Controlla la connessione e riprova.'});

export async function pushStatus(endpoint?:string) {
  try{
    const {db,user}=await session();
    const {data:status,error}=await db.from('push_scheduler_status').select('last_run_at').eq('id',true).single();
    if(error)return {error:'Archivio notifiche da attivare in Supabase.',configured:Boolean(pushConfiguration()),schedulerActive:false,active:false};
    let id:string|undefined;
    if(endpoint&&allowedPushEndpoint(endpoint)){
      const {data}=await db.from('push_subscriptions').select('id,vapid_public_key').eq('user_id',user.id).eq('endpoint',endpoint).maybeSingle();
      if(data&&data.vapid_public_key===process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY){id=data.id;await rememberPushDevice(data.id);}
    }
    const recent=status.last_run_at&&Date.now()-Date.parse(status.last_run_at)<5*60*1000;
    return {configured:Boolean(pushConfiguration()),schedulerActive:Boolean(recent),active:Boolean(id),id,lastRun:status.last_run_at as string|null};
  }catch(error){return {...failure(error),configured:false,schedulerActive:false,active:false};}
}

export async function enablePush(input:unknown) {
  try{
    const config=pushConfiguration();if(!config)return {error:'Le notifiche devono ancora essere configurate.'};
    const device=parsePushDevice(input),{db}=await session();
    const {data:id,error}=await db.rpc('register_visilab_push',{p_endpoint:device.endpoint,p_p256dh:device.keys.p256dh,p_auth:device.keys.auth,p_vapid:config.publicKey});
    if(error||!validId(id))return {error:'Dispositivo non abilitato. Riprova ad attivarlo; sono consentiti fino a 10 dispositivi per account.'};
    await rememberPushDevice(id);return {id};
  }catch(error){return failure(error);}
}

export async function disablePush(endpoint:string) {
  if(!allowedPushEndpoint(endpoint))return {error:'Dispositivo non valido.'};
  try{
    const {db,user}=await session();
    const {error}=await db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',endpoint);
    if(error)return {error:'Disattivazione non riuscita. Riprova.'};
    await clearPushCookie();return {ok:true};
  }catch(error){return failure(error);}
}

export async function testPush(id:string) {
  if(!validId(id))return {error:'Dispositivo non valido.'};
  try{
    const {db,user}=await session();
    const {data,error}=await db.rpc('claim_visilab_push_test',{p_id:id});
    if(error)return {error:'Prova non disponibile. Verifica la configurazione delle notifiche.'};
    if(!data)return {error:'Attendi un minuto prima di ripetere la prova, oppure riattiva le notifiche.'};
    if(data.vapidPublicKey!==process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)return {error:'Riattiva le notifiche su questo dispositivo.'};
    const result=await sendPush(data,notificationPayload());
    if(result.expired){await db.from('push_subscriptions').delete().eq('id',id).eq('user_id',user.id);return {error:'Autorizzazione scaduta. Disattiva e riattiva le notifiche.'};}
    return result.ok?{ok:true}:{error:'Invio non confermato. Controlla la connessione e le impostazioni delle notifiche.'};
  }catch(error){return failure(error);}
}
