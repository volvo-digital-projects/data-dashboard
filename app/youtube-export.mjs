// Browser-only XLSX export: no server request, external upload or extra dependency.
// The package is a standard SpreadsheetML ZIP with typed values and inline strings.
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const letters = index => {let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
const crcTable = Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function zip(files){
  const encoder=new TextEncoder(), chunks=[], directory=[];let offset=0;
  for(const [name,text] of files){
    const filename=encoder.encode(name), body=encoder.encode(text), crc=crc32(body);
    const header=new Uint8Array(30+filename.length), h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);
    h.setUint32(14,crc,true);h.setUint32(18,body.length,true);h.setUint32(22,body.length,true);h.setUint16(26,filename.length,true);header.set(filename,30);
    const central=new Uint8Array(46+filename.length), c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,body.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);central.set(filename,46);
    chunks.push(header,body);directory.push(central);offset+=header.length+body.length;
  }
  const directorySize=directory.reduce((n,b)=>n+b.length,0), end=new Uint8Array(22), e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);
  const result=new Uint8Array(offset+directorySize+end.length);let cursor=0;
  for(const chunk of [...chunks,...directory,end]){result.set(chunk,cursor);cursor+=chunk.length;}return result;
}
function cell(value,index,row,style=0){
  const address=`${letters(index)}${row}`;
  if(value===null||value===undefined)return `<c r="${address}" s="${style}"/>`;
  if(value instanceof Date){if(!Number.isFinite(value.getTime()))return cell(null,index,row,style);return `<c r="${address}" s="5"><v>${value.getTime()/86400000+25569}</v></c>`;}
  if(typeof value==='number'&&Number.isFinite(value))return `<c r="${address}" s="${style||2}"><v>${value}</v></c>`;
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function worksheet(sheet){
  const end=`${letters(sheet.headers.length-1)}${sheet.rows.length+5}`;
  const rows=[`<row r="2" ht="25" customHeight="1">${cell(sheet.title,0,2,7)}</row>`,...sheet.notes.map((note,i)=>`<row r="${i+3}" ht="20" customHeight="1">${cell(note,0,i+3,10)}</row>`),`<row r="5" ht="32" customHeight="1">${sheet.headers.map((h,i)=>cell(h,i,5,1)).join('')}</row>`];
  sheet.rows.forEach((values,index)=>rows.push(`<row r="${index+6}" ht="${sheet.rowHeight||25}" customHeight="1">${values.map((value,col)=>cell(value,col,index+6,sheet.styles?.[col]??0)).join('')}</row>`));
  return declaration+`<worksheet xmlns="${ns}"><dimension ref="A1:${end}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane xSplit="3" ySplit="5" topLeftCell="D6" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${sheet.widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A5:${end}"/></worksheet>`;
}
const styles=declaration+`<styleSheet xmlns="${ns}"><numFmts count="3"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts><fonts count="5"><font><sz val="10"/><color rgb="FF233E4C"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><color rgb="FF164F70"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF178376"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FFBC5541"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF164F70"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11">${[
  [0,0,0,'left',false],[0,1,2,'center',true],[3,0,0,'right',false],[164,0,0,'right',false],[166,0,0,'right',false],[165,0,0,'right',false],[0,0,0,'left',true],[0,2,0,'left',false],[0,3,0,'left',true],[0,4,0,'left',true],[0,0,0,'left',false]
].map(([num,font,fill,align,wrap])=>`<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="${align}" vertical="${wrap?'top':'center'}" wrapText="${wrap?1:0}"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
export function workbookBytes(sheets){
  const files=[['[Content_Types].xml',declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],['_rels/.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],['xl/workbook.xml',declaration+`<workbook xmlns="${ns}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],['xl/_rels/workbook.xml.rels',declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],['xl/styles.xml',styles]];
  sheets.forEach((sheet,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,worksheet(sheet)]));return zip(files);
}
const kst = date => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(date));
const asDate = text => {const m=text?.match(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):null;};
export function youtubeSheets({people,metrics,comments,editorial,codes,dailyClose}){
  const sorted=[...people].sort((a,b)=>(b.channel.subscribers??-1)-(a.channel.subscribers??-1)), owner=new Set();
  const metricRows=sorted.map(p=>{
    const previous=dailyClose?.channelSubscribers[p.channelId], sharedDuplicate=owner.has(p.channelId);owner.add(p.channelId);
    const delta=!sharedDuplicate&&typeof previous==='number'&&typeof p.channel.subscribers==='number'?p.channel.subscribers-previous:null;
    return [`${p.dealer}(${codes[p.dealer]})`,p.showroom,p.name,p.isTeamLeader?'팀장':'직원',asDate(p.hireDate),asDate(p.channel.joined),...p.certifications,p.channel.subscribers,delta,delta!==null&&previous>0?delta/previous:null,p.channel.averageViews,p.channel.totalViews,p.channel.long.count,p.channel.long.averageViews,p.channel.short.count,p.channel.short.averageViews,p.score,p.responses,p.monthly,p.delivered,comments.channels[p.channelId]?.status==='complete'?comments.channels[p.channelId].total:null,p.shared?'공동 채널':'',`https://www.youtube.com/channel/${p.channelId}`];
  });
  const performance={name:'유튜브 성과표',title:'유튜브 크리에이터 성과 비교',notes:[`지표 수집 ${kst(metrics.lastSuccessfulRefreshAt)} (한국시간) · 전체 ${people.length}명 / ${metrics.channels.length}채널`,`출처: Data Dashboard · 공동 채널 구독자는 직원 행별 반복, 전일 증감은 한 번만 표시`],headers:['딜러사','전시장','직원','직책','볼보 입사일','채널 개설일','Grand 횟수','Advanced 횟수','Certified 횟수','구독자(명)','전일 증감(명)','전일 증감률','평균 조회수(회)','누적 조회수(회)','롱폼(개)','롱폼 평균 조회(회)','숏츠(개)','숏츠 평균 조회(회)','고객상담 평균만족도(점)','회신 수(건)','2026 월평균 판매(대)','2026 누적 판매(대)','공개 댓글·답글(건)','공동 채널','채널 URL'],widths:[18,14,13,10,15,15,13,15,15,14,15,15,18,19,13,22,13,22,26,15,24,23,24,17,66],styles:[0,0,0,0,5,5,2,2,2,2,2,4,2,2,2,2,2,2,3,2,3,2,2,0,0],rows:metricRows};
  const reactions={name:'댓글분석',title:'유튜브 댓글분석 결과',notes:[`분석 기준 ${kst(editorial.reviewedAt)} (한국시간) · 댓글 수집 ${kst(comments.checkedAt)} (한국시간)`,'공동 채널 분석은 공동 운영 직원에게 동일하게 표시'],headers:['딜러사','전시장','직원','공개 댓글·답글(건)','긍정 반응','부정 반응','공동 채널','채널 URL'],widths:[18,14,13,24,66,72,18,66],styles:[0,0,0,2,8,9,0,0],rowHeight:68,rows:sorted.map(p=>{const review=editorial.channels[p.channelId];return [`${p.dealer}(${codes[p.dealer]})`,p.showroom,p.name,comments.channels[p.channelId]?.status==='complete'?comments.channels[p.channelId].total:null,review?.positive.join('\n')??'분석 준비 중',review?.negative.join('\n')??'분석 준비 중',p.shared?'공동 채널':'',`https://www.youtube.com/channel/${p.channelId}`];})};
  return [performance,reactions];
}
export function downloadYoutubeWorkbook(input){
  const bytes=workbookBytes(youtubeSheets(input)), blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download=`유튜브_성과_댓글분석_${kst(input.metrics.lastSuccessfulRefreshAt).replace(/[-: ]/g,'')}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
