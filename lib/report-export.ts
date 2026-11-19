export const reportFilename='visilab-visite.pdf';

export function isAppleMobileBrowser(userAgent:string,maxTouchPoints=0){
  return /iPhone|iPad|iPod/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&maxTouchPoints>1);
}

export async function fetchReportPdf(signal:AbortSignal,request:typeof fetch=fetch):Promise<File>{
  const response=await request('/api/report/pdf',{signal,credentials:'same-origin',cache:'no-store'});
  if(!response.ok){
    if(response.status===401)throw new Error('Sessione scaduta. Torna al report e accedi di nuovo.');
    throw new Error('Non è stato possibile preparare il PDF. Riprova.');
  }
  if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf'))throw new Error('Il file ricevuto non è un PDF valido. Riprova.');
  const blob=await response.blob();
  if(await blob.slice(0,5).text()!=='%PDF-')throw new Error('Il PDF ricevuto è incompleto. Riprova.');
  if(signal.aborted)throw new DOMException('Richiesta annullata','AbortError');
  return new File([blob],reportFilename,{type:'application/pdf'});
}

export function canShareReportFile(api:Pick<Navigator,'canShare'|'share'>,file:File):boolean{
  try{return typeof api.share==='function'&&typeof api.canShare==='function'&&api.canShare({files:[file]});}catch{return false;}
}

export function shareReportFile(api:Pick<Navigator,'canShare'|'share'>,file:File):Promise<void>{
  if(!canShareReportFile(api,file))return Promise.reject(new Error('Il dispositivo non consente di condividere questo PDF.'));
  // No fetch, dynamic import or await before share: preserve the fresh tap on iOS.
  try{return api.share({files:[file],title:'Report visite VisiLab'});}
  catch(error){return Promise.reject(error);}
}
