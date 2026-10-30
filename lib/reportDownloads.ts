import type {ReportData} from './siteReport';
const ascii=(s:string)=>s.replace(/[^\x20-\x7e]/g,c=>({'—':'-','–':'-','→':'>','₂':'2','₃':'3','₹':'INR','°':' deg ','•':'*','·':'.'}[c]||'?'));
const xml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const encoder=new TextEncoder();
function crc32(data:Uint8Array){let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}return(crc^0xffffffff)>>>0;}
function zip(entries:{name:string;data:string}[]):Uint8Array{const chunks:Uint8Array[]=[];const central:Uint8Array[]=[];let offset=0;const u16=(d:DataView,o:number,v:number)=>d.setUint16(o,v,true);const u32=(d:DataView,o:number,v:number)=>d.setUint32(o,v,true);for(const entry of entries){const name=encoder.encode(entry.name),data=encoder.encode(entry.data),crc=crc32(data);const lh=new Uint8Array(30+name.length);const lv=new DataView(lh.buffer);u32(lv,0,0x04034b50);u16(lv,4,20);u32(lv,14,crc);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);lh.set(name,30);chunks.push(lh,data);const ch=new Uint8Array(46+name.length);const cv=new DataView(ch.buffer);u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u32(cv,42,offset);ch.set(name,46);central.push(ch);offset+=lh.length+data.length;}const start=offset;for(const ch of central){chunks.push(ch);offset+=ch.length;}const end=new Uint8Array(22);const dv=new DataView(end.buffer);u32(dv,0,0x06054b50);u16(dv,8,entries.length);u16(dv,10,entries.length);u32(dv,12,offset-start);u32(dv,16,start);chunks.push(end);const result=new Uint8Array(chunks.reduce((s,c)=>s+c.length,0));let i=0;for(const c of chunks){result.set(c,i);i+=c.length;}return result;}
export function downloadWord(report:ReportData){
 const paragraph=(text:string,style?:string)=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:''}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
 const table=(rows:string[][])=>`<w:tbl><w:tblPr><w:tblBorders>${['top','bottom','left','right','insideH','insideV'].map(x=>`<w:${x} w:val="single" w:sz="3" w:color="CAD5E2"/>`).join('')}</w:tblBorders></w:tblPr>${rows.map((r,i)=>`<w:tr>${r.map(c=>`<w:tc><w:tcPr><w:shd w:fill="${i===0?'DBEAFE':i%2?'F8FAFC':'FFFFFF'}"/></w:tcPr>${paragraph(c)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;
 const body=[paragraph(report.title,'Title'),paragraph(`Generated ${report.generated}`),paragraph(report.introduction),...report.sections.flatMap(s=>[paragraph(s.title,'Heading1'),paragraph(s.explanation),table([s.columns,...s.rows])])].join('');
 const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="720" w:bottom="900" w:left="720"/></w:sectPr></w:body></w:document>`;
 const styles=`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="38"/><w:color w:val="12345A"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="145C7A"/></w:rPr></w:style></w:styles>`;
 const bytes=zip([{name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},{name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},{name:'word/_rels/document.xml.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},{name:'word/styles.xml',data:styles},{name:'word/document.xml',data:doc}]);download(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),'Carbon-Ledger-Complete-Report.docx');}
function pdfEscape(s:string){return ascii(s).replace(/[\\()]/g,'\\$&');}
export function downloadPdf(report:ReportData){
 // Real repeated-header, paginated table grids; no flattened pipe-delimited rows.
 const PAGE_W=842, PAGE_H=595, LEFT=42, RIGHT=42, CONTENT=PAGE_W-LEFT-RIGHT;
 const pages:string[][]=[[]];let page=pages[0]!, y=PAGE_H-60;
 const add=(s:string)=>page.push(s);
 const drawText=(s:string,x:number,top:number,size=8,bold=false)=>add(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${top.toFixed(1)} Tm (${pdfEscape(s)}) Tj ET`);
 const rect=(x:number,bottom:number,w:number,h:number,r:number,g:number,b:number)=>add(`${r} ${g} ${b} rg ${x.toFixed(1)} ${bottom.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f 0.12 0.22 0.33 rg`);
 const newPage=()=>{page=[];pages.push(page);y=PAGE_H-60;};
 const wrapWidth=(value:string,width:number,size:number)=>{
  const max=Math.max(5,Math.floor((width-16)/(size*0.54))),words=ascii(value||'—').split(/\s+/),lines:string[]=[];let line='';
  for(let word of words){if(word.length>max){if(line){lines.push(line);line='';}while(word.length>max){lines.push(word.slice(0,max));word=word.slice(max);}}
   if(!word)continue;
   if(line&&line.length+1+word.length>max){lines.push(line);line=word;}else line=line?line+' '+word:word;
  }
  if(line)lines.push(line);return lines.length?lines:['—'];
 };
 const textBlock=(value:string,size=9,bold=false)=>{
  for(const ln of wrapWidth(value,CONTENT,size)){if(y<52)newPage();drawText(ln,LEFT,y,size,bold);y-=size+5;}
 };
 const columnWidths=(n:number)=>{
  const weights=n===1?[1]:n===2?[.26,.74]:n===3?[.23,.38,.39]:n===4?[.19,.26,.27,.28]:Array(n).fill(1/n);
  return weights.map(w=>w*CONTENT);
 };
 const drawTable=(headers:string[],data:string[][])=>{
  const n=Math.max(1,headers.length),widths=columnWidths(n),xAt=(i:number)=>LEFT+widths.slice(0,i).reduce((a,b)=>a+b,0);
  const row=(cells:string[],header:boolean,index:number)=>{
   const font=header?7.4:7.1,lineH=10.5;
   const lines=widths.map((w,i)=>wrapWidth(cells[i]??'—',w,font));
   let position=0; const maxLines=Math.max(...lines.map(a=>a.length));
   do{
    const available=Math.max(1,Math.floor((y-48-12)/lineH));
    if(y<70||available<2){newPage();if(!header)paintHeader();}
    const count=Math.min(maxLines-position,Math.max(1,Math.floor((y-48-12)/lineH)));
    const h=count*lineH+12, bottom=y-h+5;
    rect(LEFT,bottom,CONTENT,h,header?.08:index%2===0?.96:1,header?.25:index%2===0?.98:1,header?.28:index%2===0?1:1);
    // Column rules
    for(let i=1;i<n;i++){const x=xAt(i);add(`0.78 0.83 0.88 RG 0.35 w ${x.toFixed(1)} ${bottom.toFixed(1)} m ${x.toFixed(1)} ${(bottom+h).toFixed(1)} l S`);}
    for(let i=0;i<n;i++)for(let l=0;l<count;l++){
     const line=lines[i]?.[position+l];if(line){add(header?'1 1 1 rg':'0.08 0.16 0.24 rg');drawText(line,xAt(i)+7,y-11-l*lineH,font,header);}
    }
    y-=h+3;position+=count;
   }while(position<maxLines);
  };
  const paintHeader=()=>{const font=7.4,ls=widths.map((w,i)=>wrapWidth(headers[i]??'',w,font));const height=Math.max(...ls.map(x=>x.length))*10.5+12;
   if(y-height<48)newPage();const bottom=y-height+5;rect(LEFT,bottom,CONTENT,height,.08,.25,.28);
   for(let i=0;i<n;i++){add('1 1 1 rg');ls[i]?.forEach((l,k)=>drawText(l,xAt(i)+7,y-11-k*10.5,font,true));}y-=height+3;};
  paintHeader();
  for(let i=0;i<data.length;i++)row(data[i]??[],false,i);
 };
 textBlock(report.title,17,true);y-=3;textBlock(`Generated: ${report.generated}`,9);y-=7;textBlock(report.introduction,9);y-=14;
 for(const section of report.sections){if(y<126)newPage();textBlock(section.title,12,true);textBlock(section.explanation,8);y-=6;drawTable(section.columns,section.rows);y-=13;}
 const objects:string[]=[''];const addObject=(s:string)=>{objects.push(s);return objects.length-1;};
 const font=addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const bold=addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');const pagesId=addObject('');const pageIds:number[]=[];
 for(let i=0;i<pages.length;i++){
  const content=`0.08 0.16 0.24 rg\n${pages[i]!.join('\n')}\n0.3 0.45 0.55 rg\nBT /F1 8 Tf 1 0 0 1 42 24 Tm (Carbon Ledger | Page ${i+1} of ${pages.length}) Tj ET`;
  const stream=addObject(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`));
 }
 objects[pagesId]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(i=>`${i} 0 R`).join(' ')}] >>`;
 const catalog=addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
 let pdf='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=encoder.encode(pdf).length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}const xref=encoder.encode(pdf).length;pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;for(let i=1;i<objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
 download(new Blob([encoder.encode(pdf)],{type:'application/pdf'}),'Carbon-Ledger-Detailed-Report.pdf');
}
