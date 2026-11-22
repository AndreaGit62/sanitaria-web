/* Push only: clinical pages and documents are never stored in an offline cache. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

function safeNotificationPath(value){
  return typeof value==='string'&&/^\/\?appointment=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:'/';
}

self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{/* Always show an incoming push. */}
  const url=safeNotificationPath(data.url),isReminder=url!=='/';
  event.waitUntil(self.registration.showNotification('VisiLab',{
    body:isReminder?(data.purpose==='booking'?'Hai una visita da prenotare. Tocca per vedere il promemoria.':'Hai un appuntamento in programma. Tocca per vedere i dettagli.'):'Le notifiche di VisiLab funzionano su questo dispositivo.',
    icon:'/icons/visilab-192.png',
    tag:typeof data.tag==='string'&&data.tag.startsWith('visilab-')?data.tag.slice(0,160):'visilab-avviso',
    data:{url},renotify:false,
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(safeNotificationPath(event.notification.data?.url),self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){try{const navigated=await existing.navigate(target);if(navigated){await navigated.focus();return;}}catch{/* The window may have closed meanwhile. */}}
    await self.clients.openWindow(target);
  })());
});
