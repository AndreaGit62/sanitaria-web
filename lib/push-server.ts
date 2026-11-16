import 'server-only';
import { createECDH, createHash } from 'node:crypto';
import * as webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { parsePushDevice, type PushDevice } from './push-validation';

export const pushDeviceCookie='visilab-push-device';

export function pushConfiguration() {
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.NEXT_PUBLIC_SITE_URL;
  if(!publicKey||!privateKey||!subject)return null;
  try{
    const url=new URL(subject);
    if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))return null;
    const curve=createECDH('prime256v1');curve.setPrivateKey(Buffer.from(privateKey,'base64url'));
    if(curve.getPublicKey().toString('base64url')!==publicKey)return null;
    return {publicKey,privateKey,subject:url.origin};
  }catch{return null;}
}

export function pushAdmin() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error('Invio automatico da configurare.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function sendPush(device:PushDevice,payload:ReturnType<typeof import('./push-validation').notificationPayload>) {
  const config=pushConfiguration();
  if(!config)throw new Error('Notifiche da configurare.');
  const subscription=parsePushDevice(device);
  try{
    const result=await webpush.sendNotification(subscription,JSON.stringify(payload),{
      vapidDetails:config,TTL:payload.url==='/'?60:900,urgency:'high',timeout:7000,
      topic:createHash('sha256').update(payload.tag).digest('base64url').slice(0,32),
    });
    return {ok:true,status:result.statusCode,expired:false};
  }catch(error){
    const code=Number((error as {statusCode?:number})?.statusCode)||0;
    // A timeout may have happened after acceptance. Do not resend blindly.
    return {ok:false,status:code,expired:code===404||code===410};
  }
}

export async function rememberPushDevice(id:string) {
  (await cookies()).set(pushDeviceCookie,id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:365*24*3600});
}

export async function clearPushCookie() {(await cookies()).delete(pushDeviceCookie);}
