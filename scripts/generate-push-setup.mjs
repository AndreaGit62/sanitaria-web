// Creates local setup material; never prints private keys or tokens.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {generateVAPIDKeys} from 'web-push';
import {randomBytes,createECDH} from 'node:crypto';

const root=new URL('../',import.meta.url),envFile=new URL('.env.push.generated.local',root);
let env;
try{env=await readFile(envFile,'utf8');}catch(error){
  if(error.code!=='ENOENT')throw error;
  const pair=generateVAPIDKeys();
  env=`# Private setup material. Do not commit or paste into chat.\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=${pair.publicKey}\nVAPID_PRIVATE_KEY=${pair.privateKey}\nPUSH_CRON_SECRET=${randomBytes(32).toString('hex')}\n`;
  await writeFile(envFile,env,{flag:'wx'});
}
const values=Object.fromEntries(env.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const curve=createECDH('prime256v1');curve.setPrivateKey(Buffer.from(values.VAPID_PRIVATE_KEY,'base64url'));
if(curve.getPublicKey().toString('base64url')!==values.NEXT_PUBLIC_VAPID_PUBLIC_KEY||!/^[a-f0-9]{64}$/.test(values.PUSH_CRON_SECRET))throw new Error('Configurazione locale non valida. Non rigenerare le chiavi già usate.');
let local='';try{local=await readFile(new URL('.env.local',root),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
for(const name of ['NEXT_PUBLIC_VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','PUSH_CRON_SECRET']){
  const pattern=new RegExp(`^${name}=.*$`,'m');
  local=pattern.test(local)?local.replace(pattern,`${name}=${values[name]}`):`${local.trimEnd()}\n${name}=${values[name]}\n`;
}
await writeFile(new URL('.env.local',root),local);
await mkdir(new URL('supabase/local/',root),{recursive:true});
const token=values.PUSH_CRON_SECRET;
const sql=`-- Private activation script: contains the scheduler token. Never commit or share.\nbegin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;
do $setup$
declare secret_id uuid;
begin
  select id into secret_id from vault.secrets where name='visilab_push_cron_secret' limit 1;
  if secret_id is null then
    perform vault.create_secret('${token}','visilab_push_cron_secret','VisiLab scheduler authorization');
  else
    perform vault.update_secret(secret_id,'${token}');
  end if;
end $setup$;
select cron.schedule('visilab-reminders','* * * * *',$job$
  select net.http_post(
    url:='https://sanitaria-web-84gz.vercel.app/api/notifications/dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='visilab_push_cron_secret' limit 1)),
    body:='{}'::jsonb,timeout_milliseconds:=45000
  );
$job$);
commit;
`;
await writeFile(new URL('supabase/local/activate_push.sql',root),sql);
console.log('Preparati .env.push.generated.local e supabase/local/activate_push.sql (esclusi da Git). Configurazione locale aggiornata. Nessun segreto stampato.');
