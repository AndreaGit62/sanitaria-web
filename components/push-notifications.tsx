'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, Send, Smartphone } from 'lucide-react';
import { disablePush, enablePush, pushStatus, testPush } from '../app/notifications/actions';
import { isIphone, isIphoneApp } from '../lib/push-device-policy';

type Status=Awaited<ReturnType<typeof pushStatus>>;
const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
function keyBytes(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}

export default function PushNotifications(){
  const [supported,setSupported]=useState<boolean|null>(null),[needsHome,setNeedsHome]=useState(false);
  const [device,setDevice]=useState<'iphone'|'other'|null>(null);
  const [permission,setPermission]=useState<NotificationPermission>('default');
  const [registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null);
  const [subscription,setSubscription]=useState<PushSubscription|null>(null);
  const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    async function load(){
      const standalone=window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
      const iphone=isIphone(navigator.userAgent);
      setDevice(iphone?'iphone':'other');
      setNeedsHome(iphone&&!standalone);
      if(!iphone){
        // Retire the old subscription even when it belonged to another account on this shared browser.
        // Unsubscribe locally first; the database migration removes stale desktop records globally.
        try{
          if('serviceWorker' in navigator){
            const previous=await navigator.serviceWorker.getRegistration('/');
            const sub=await previous?.pushManager.getSubscription();
            if(sub){
              const removed=await sub.unsubscribe();
              if(!removed)throw new Error('unsubscribe');
              const result=await disablePush(sub.endpoint);
              if('error' in result&&live)setError('Avvisi del browser disattivati. La pulizia sul server verrà completata con l’aggiornamento.');
            }
            const notifications=await previous?.getNotifications();
            notifications?.forEach(notification=>notification.close());
          }
        }catch{if(live)setError('Non è stato possibile disattivare i vecchi avvisi del browser. Riapri questa sezione con una connessione attiva.');}
        return;
      }
      if(!standalone)return;
      const capable='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
      setSupported(capable);if(!capable)return;
      setPermission(Notification.permission);
      try{
        const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
        await navigator.serviceWorker.ready;
        const sub=await reg.pushManager.getSubscription();
        const state=await pushStatus(sub?.endpoint);
        if(live){setRegistration(reg);setSubscription(sub);setStatus(state);}
      }catch{if(live)setError('Impossibile controllare le notifiche. Verifica la connessione e riapri questa pagina.');}
    }
    void load();return()=>{live=false;};
  },[]);
  async function enable(){
    const standalone=window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
    if(!isIphoneApp(navigator.userAgent,standalone)||!registration||!publicKey||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      // Permission is requested directly from the tap for iOS.
      const allowed=await Notification.requestPermission();setPermission(allowed);
      if(allowed!=='granted'){setError('Permesso non concesso. Puoi abilitarlo nelle impostazioni del dispositivo.');return;}
      let sub=await registration.pushManager.getSubscription();
      if(sub&&!status?.active){
        // A new endpoint prevents a shared browser from adopting another account's subscription.
        if(!await sub.unsubscribe())throw new Error('Disattivazione della precedente autorizzazione non riuscita. Riprova.');
        sub=null;
      }
      if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
      setSubscription(sub);
      const result=await enablePush(sub.toJSON());
      if('error' in result){setError(result.error);return;}
      setStatus(await pushStatus(sub.endpoint));setMessage('Dispositivo abilitato. Premi “Invia prova” per controllare la ricezione.');
    }catch(cause){setError(cause instanceof Error&&cause.message.startsWith('Disattivazione')?cause.message:'Attivazione non riuscita. Apri VisiLab dalla Home e controlla le autorizzazioni.');}
    finally{setBusy(false);}
  }
  async function disable(){
    if(!subscription||busy)return;setBusy(true);setError('');setMessage('');
    try{
      const result=await disablePush(subscription.endpoint);
      if('error' in result){setError(result.error);return;}
      await subscription.unsubscribe();setSubscription(null);setStatus(await pushStatus());setMessage('Notifiche disattivate su questo dispositivo.');
    }catch{setError('Controlla la connessione e riprova a disattivare le notifiche.');}
    finally{setBusy(false);}
  }
  async function test(){
    if(!status||!('id' in status)||!status.id||busy)return;setBusy(true);setError('');setMessage('');
    try{const result=await testPush(status.id);if('error' in result)setError(result.error);else setMessage('Avviso di prova inviato. Controlla le notifiche di VisiLab.');}
    catch{setError('Invio non confermato. Controlla la connessione.');}finally{setBusy(false);}
  }
  const registered=Boolean(status?.active&&subscription);
  const active=registered&&permission==='granted';
  if(device==='other')return <section className="panel push-settings" aria-labelledby="push-title"><div className="push-heading"><span className="stat-icon green"><Smartphone size={24}/></span><div><h2 id="push-title">Avvisi sul tuo iPhone</h2><p>Attiva i promemoria dal tuo iPhone personale.</p></div></div><p className="push-privacy">Da questo dispositivo puoi gestire le visite e alternare gli account. Gli avvisi vengono inviati solo agli iPhone abilitati; uscire dal PC non disattiva quelli del telefono.</p>{error&&<p className="error" role="alert">{error}</p>}</section>;
  return <section className="panel push-settings" aria-labelledby="push-title">
    <div className="push-heading"><span className="stat-icon green"><Smartphone size={24}/></span><div><h2 id="push-title">Avvisi su questo dispositivo</h2><p>Un promemoria anche quando VisiLab è chiusa.</p></div></div>
    {device===null||(!needsHome&&supported===null)?<p role="status">Controllo delle notifiche…</p>:null}
    {needsHome&&<p className="push-note">Su iPhone apri VisiLab dall’icona aggiunta alla schermata Home. Serve iOS 16.4 o successivo.</p>}
    {supported===false&&!needsHome&&<p className="push-note">Questo browser non supporta le notifiche Web Push. Prova un browser aggiornato.</p>}
    {supported&&!needsHome&&<>
      <div className="push-state"><span className={`tiny-dot ${active?'':'muted'}`}/><strong>{active?'Dispositivo abilitato':'Notifiche non attive su questo dispositivo'}</strong></div>
      <p className="push-scheduler">{status?.schedulerActive?'Controllo automatico attivo · ogni minuto.':'La programmazione automatica deve essere attivata o verificata.'}</p>
      {!status?.configured&&status&&<p className="push-note">Stiamo completando la configurazione dell’invio. L’attivazione sarà disponibile appena pronta.</p>}
      {permission==='denied'&&<p className="push-note">Le notifiche sono bloccate. Consenti gli avvisi per VisiLab nelle impostazioni del dispositivo, poi riapri questa pagina.</p>}
      <div className="push-buttons">{registered?<><button className="button primary" disabled={busy||permission!=='granted'} onClick={()=>void test()}><Send size={16}/>Invia prova</button><button className="button subtle" disabled={busy} onClick={()=>void disable()}><BellOff size={16}/>Disattiva su questo dispositivo</button></>:<button className="button primary" disabled={busy||!registration||!status?.configured||Boolean(status?.error)||permission==='denied'} onClick={()=>void enable()}><Bell size={17}/>{busy?'Attivazione…':'Attiva notifiche'}</button>}</div>
    </>}
    {(error||status?.error)&&<p className="error" role="alert">{error||status?.error}</p>}
    {message&&<p className="push-success" role="status">{message}</p>}
    <p className="push-privacy">Gli avvisi non mostrano il tipo di visita né la struttura. Serve Internet; modalità silenziosa e Full immersion possono limitarli. Gli orari sono riferiti all’Italia.</p>
  </section>;
}
