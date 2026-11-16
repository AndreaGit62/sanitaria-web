import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {generateVAPIDKeys,generateRequestDetails} from 'web-push';
import {allowedPushEndpoint,notificationPayload,parsePushDevice} from '../lib/push-validation.ts';
import {reminderEpoch} from '../lib/appointments.ts';

const subscription={endpoint:'https://web.push.apple.com/test',keys:{p256dh:generateVAPIDKeys().publicKey,auth:randomBytes(16).toString('base64url')}};
test('valida le sottoscrizioni e blocca endpoint locali, redirect e host estranei',()=>{
  assert.deepEqual(parsePushDevice({...subscription,user_id:'forzato'}),subscription);
  for(const url of ['http://web.push.apple.com/x','https://127.0.0.1/x','https://web.push.apple.com.attacker.org/x','https://web.push.apple.com@attacker.org/x','https://web.push.apple.com:8443/x','https://fcm.googleapis.com/x#hash','https://example.org/x'])assert.equal(allowedPushEndpoint(url),false,url);
  for(const endpoint of ['https://web.push.apple.com/x','https://fcm.googleapis.com/fcm/send/x','https://updates.push.services.mozilla.com/x','https://wns2.notify.windows.com/x'])assert.ok(allowedPushEndpoint(endpoint));
  assert.throws(()=>parsePushDevice({...subscription,keys:{...subscription.keys,auth:'x'}}));
});
test('VAPID e cifratura generano una richiesta compatibile senza effettuare invii',()=>{
  const vapid=generateVAPIDKeys();const payload=notificationPayload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2027-01-01T10:00:00Z');
  const request=generateRequestDetails(subscription,JSON.stringify(payload),{vapidDetails:{...vapid,subject:'https://sanitaria-web-84gz.vercel.app'},TTL:900,urgency:'high'});
  assert.ok(request.body.length>0);assert.ok(request.headers.Authorization||request.headers.authorization);
  assert.ok(!JSON.stringify(payload).includes('Ospedale'));assert.ok(!JSON.stringify(payload).includes('cardiologica'));
});
test('orari italiani indipendenti dal fuso del dispositivo; rifiuta ore inesistenti o ambigue',()=>{
  assert.equal(reminderEpoch('2027-01-15T10:00'),Date.parse('2027-01-15T09:00:00Z'));
  assert.equal(reminderEpoch('2027-07-15T10:00'),Date.parse('2027-07-15T08:00:00Z'));
  for(const time of ['2027-03-28T02:30','2027-10-31T02:30'])assert.throws(()=>reminderEpoch(time));
});
test('service worker mostra testo discreto e apre solo l’origine di VisiLab',async()=>{
  const handlers={},shown=[],opened=[];let navigated='';
  const self={location:{origin:'https://visilab.example'},addEventListener:(name,handler)=>handlers[name]=handler,
    registration:{showNotification:async(title,options)=>shown.push({title,...options})},
    clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)},skipWaiting:async()=>{}};
  vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
  let pending;const waitUntil=p=>pending=p;
  handlers.push({data:{json:()=>({url:'https://attacker.example/private',body:'Dati sanitari',title:'Titolo esterno'})},waitUntil});await pending;
  assert.equal(shown[0].title,'VisiLab');assert.ok(!shown[0].body.includes('Dati sanitari'));assert.equal(shown[0].data.url,'/');
  handlers.notificationclick({notification:{close(){},data:{url:'//attacker.example'}},waitUntil});await pending;
  assert.equal(opened[0],'https://visilab.example/');
  const path='/?appointment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  self.clients.matchAll=async()=>[{url:'https://visilab.example/',navigate:async url=>{navigated=url;return {focus:async()=>{}};}}];
  handlers.notificationclick({notification:{close(){},data:{url:path}},waitUntil});await pending;
  assert.equal(navigated,'https://visilab.example'+path);assert.equal(handlers.fetch,undefined);
  self.clients.matchAll=async()=>[{url:'https://visilab.example/',navigate:async()=>{throw new Error('Closed window');}}];
  handlers.notificationclick({notification:{close(){},data:{url:path}},waitUntil});await pending;
  assert.equal(opened.at(-1),'https://visilab.example'+path);
});
