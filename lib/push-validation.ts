import { ECDH } from 'node:crypto';

export type PushDevice = { endpoint:string; keys:{p256dh:string;auth:string} };

export function allowedPushEndpoint(value:unknown): value is string {
  if(typeof value!=='string'||value.length>2048)return false;
  try{
    const url=new URL(value),host=url.hostname;
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash&&url.pathname!=='/'&&(
      host==='web.push.apple.com'||host==='fcm.googleapis.com'||
      host==='push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host.endsWith('.notify.windows.com')
    );
  }catch{return false;}
}

export function parsePushDevice(value:unknown):PushDevice {
  const v=value as Partial<PushDevice>|null;
  if(!v||!allowedPushEndpoint(v.endpoint)||!v.keys)throw new Error('Dispositivo per le notifiche non valido.');
  const {p256dh,auth}=v.keys;
  if(typeof p256dh!=='string'||typeof auth!=='string'||!/^B[A-Za-z0-9_-]{86}$/.test(p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(auth))throw new Error('Chiavi del dispositivo non valide.');
  const key=Buffer.from(p256dh,'base64url'),secret=Buffer.from(auth,'base64url');
  if(key.length!==65||secret.length!==16||key.toString('base64url')!==p256dh||secret.toString('base64url')!==auth)throw new Error('Chiavi del dispositivo non valide.');
  try{ECDH.convertKey(key,'prime256v1');}catch{throw new Error('Chiave pubblica del dispositivo non valida.');}
  return {endpoint:v.endpoint,keys:{p256dh,auth}};
}

export function notificationPayload(appointmentId?:string,reminderAt?:string) {
  const id=appointmentId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentId)?appointmentId:undefined;
  return {
    title:'VisiLab',
    body:id?'Hai un appuntamento in programma. Tocca per vedere i dettagli.':'Le notifiche di VisiLab funzionano su questo dispositivo.',
    url:id?`/?appointment=${id}`:'/',
    tag:id?`visilab-${id}-${reminderAt||''}`:'visilab-test',
  };
}
