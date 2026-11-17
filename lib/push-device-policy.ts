// Device selection is a product preference, not proof of device identity.
export function isIphone(userAgent:string){return /\biPhone\b/i.test(userAgent);}
export function isIphoneApp(userAgent:string,standalone:boolean){return isIphone(userAgent)&&standalone;}
export function isApplePushEndpoint(value:unknown):value is string {
  if(typeof value!=='string')return false;
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='web.push.apple.com'&&!url.port&&!url.username&&!url.password&&!url.hash&&url.pathname!=='/';}
  catch{return false;}
}
