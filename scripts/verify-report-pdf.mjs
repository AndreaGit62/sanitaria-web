// Synthetic fixtures only: never download personal records for visual QA.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createVisitReportPdf} from '../lib/report-pdf.ts';
const regular=await readFile('public/fonts/NotoSans-Regular.ttf'),bold=await readFile('public/fonts/NotoSans-Bold.ttf');
const fonts={regular:regular.toString('base64'),bold:bold.toString('base64')};
const visits=Array.from({length:62},(_,index)=>({
  id:'fixture-'+index,title:index===0?'Visita di controllo con descrizione molto lunga per verificare la corretta impaginazione della prestazione':'Visita di verifica '+String(index+1).padStart(3,'0'),
  specialty:index%4===0?'Radiologia e diagnostica per immagini':'Cardiologia',
  hospital:index%3===0?'Struttura sanitaria di prova con una denominazione estesa e reparto ambulatoriale':'Ambulatorio di prova',
  date:index>57?'':`2027-${String(1+Math.floor(index/25)).padStart(2,'0')}-${String(index%25+1).padStart(2,'0')}`,
  time:index%5?'10:30':'',doctor:index%3===0?'Dott.ssa Èrica D’Àngelo - Reparto ambulatoriale di controllo':'',notes:'',reminder:'',done:index<8,bookingStatus:index>53?'pending':'confirmed',
}));
await mkdir('tmp/pdfs',{recursive:true});
await writeFile('tmp/pdfs/visilab-report-check.pdf',Buffer.from(createVisitReportPdf({visits:[...visits].reverse(),displayName:'Utente di prova - Giulia D’Àngelo',generatedAt:'2026-11-19T12:00:00Z'},fonts)));
await writeFile('tmp/pdfs/visilab-report-empty.pdf',Buffer.from(createVisitReportPdf({visits:[],displayName:'Utente di prova',generatedAt:'2026-11-19T12:00:00Z'},fonts)));
console.log('Creati PDF di verifica con 62 visite sintetiche e un account vuoto in tmp/pdfs.');
