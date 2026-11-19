import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { bookingLabel, outcomeLabel, reportDate, reportTimestamp, sortReportVisits, type VisitReportData } from './visit-report';

export function createVisitReportPdf(data:VisitReportData,fonts:{regular:string;bold:string}):ArrayBuffer{
  const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});
  doc.addFileToVFS('NotoSans-Regular.ttf',fonts.regular);doc.addFont('NotoSans-Regular.ttf','NotoSans','normal');
  doc.addFileToVFS('NotoSans-Bold.ttf',fonts.bold);doc.addFont('NotoSans-Bold.ttf','NotoSans','bold');
  doc.setFont('NotoSans','normal');doc.setProperties({title:'VisiLab - Report di tutte le visite',author:'VisiLab',subject:'Riepilogo personale delle visite'});
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight(),margin=36;
  const ordered=sortReportVisits(data.visits),pending=ordered.filter(v=>v.bookingStatus==='pending').length;
  const header=(first:boolean)=>{
    doc.setFillColor(36,95,83);doc.rect(0,0,width,8,'F');
    doc.setFont('NotoSans','bold');doc.setTextColor(36,95,83);doc.setFontSize(18);doc.text('VisiLab',margin,36);
    doc.setFont('NotoSans','normal');doc.setFontSize(9);doc.setTextColor(104,124,115);
    doc.text('Report personale delle visite',width-margin,35,{align:'right'});
    if(first){
      doc.setFont('NotoSans','bold');doc.setTextColor(36,63,52);doc.setFontSize(23);doc.text('Tutte le visite',margin,73);
      doc.setFont('NotoSans','normal');doc.setFontSize(11);
      const nameLines=doc.splitTextToSize(data.displayName,width-2*margin-245);
      // Profile names can be long: reserve header space by wrapping instead of clipping.
      doc.text(nameLines,margin,96);
      doc.setFontSize(9);doc.setTextColor(104,124,115);doc.text('Generato il '+reportTimestamp(data.generatedAt),width-margin,96,{align:'right'});
      const bottom=96+Math.max(0,nameLines.length-1)*14;
      doc.setFontSize(10);doc.text(`${ordered.length} visite totali   |   ${ordered.length-pending} prenotate   |   ${pending} da prenotare`,margin,bottom+23);
      doc.setFontSize(9);doc.text('Ordine cronologico. Le visite senza data sono riportate in fondo. Orari italiani.',margin,bottom+41);
      return bottom+55;
    }
    return 53;
  };
  const startY=header(true);
  if(ordered.length){
    autoTable(doc,{
      startY,margin:{top:53,bottom:38,left:margin,right:margin},
      head:[['Data e ora','Visita / prestazione','Struttura / ospedale','Prenotazione','Esito']],
      body:ordered.map(v=>[
        `${reportDate(v.date)}\n${v.time||'Ora da definire'}${v.bookingStatus==='pending'&&v.date?'\nData indicativa':''}`,
        `${v.title}\n${v.specialty}${v.doctor?'\n'+v.doctor:''}`,
        v.hospital||'Struttura da scegliere',bookingLabel(v),outcomeLabel(v),
      ]),
      theme:'striped',showHead:'everyPage',rowPageBreak:'avoid',
      styles:{font:'NotoSans',fontStyle:'normal',fontSize:10.5,cellPadding:9,lineColor:[224,233,227],lineWidth:0.3,textColor:[36,63,52],overflow:'linebreak',valign:'top'},
      headStyles:{font:'NotoSans',fontStyle:'bold',fillColor:[36,95,83],textColor:[255,255,255],fontSize:10},
      alternateRowStyles:{fillColor:[245,248,245]},
      columnStyles:{0:{cellWidth:102},1:{cellWidth:250},2:{cellWidth:207},3:{cellWidth:107},4:{cellWidth:width-2*margin-666}},
      willDrawPage:hook=>{if(hook.pageNumber>1)header(false);},
      didParseCell:hook=>{
        if(hook.section==='body'&&hook.column.index===3){hook.cell.styles.fontStyle='bold';hook.cell.styles.textColor=hook.cell.raw==='Da prenotare'?[147,106,40]:[48,112,82];}
      },
    });
  }else{
    doc.setFontSize(12);doc.setTextColor(104,124,115);doc.text('Non sono presenti visite nel tuo account.',margin,startY+25);
  }
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
    doc.setPage(page);doc.setDrawColor(220,231,223);doc.line(margin,height-29,width-margin,height-29);
    doc.setFont('NotoSans','normal');doc.setFontSize(8);doc.setTextColor(115,131,121);
    doc.text('VisiLab - Riepilogo personale',margin,height-15);doc.text(`Pagina ${page} di ${pages}`,width-margin,height-15,{align:'right'});
  }
  return doc.output('arraybuffer');
}
