import {scanCsv} from './csvStream.js';
import {queryCsvSource} from './csvSourceQueries.js';
import {validateSourceEdits} from './sourceEdits.js';
import {safeSpreadsheetText} from './datasheet/transactions.js';

const csvCell=value=>{const text=safeSpreadsheetText(value);return /[\r\n",;]/.test(text)?`"${text.replaceAll('"','""')}"`:text;};
async function exportEdited(request,onProgress){
  let buffer='',headers=[];
  const emit=values=>{buffer+=values.map(csvCell).join(',')+'\r\n';if(buffer.length>=256*1024){self.postMessage({type:'chunk',id:request.id,text:buffer});buffer='';}};
  validateSourceEdits(request.edits||{});
  const result=await scanCsv(request.file,request,row=>emit(headers.map(header=>row[header])),{
    edits:request.edits,onProgress,onHeaders:names=>{headers=names;emit(request.originalHeaders||names);},
  });
  if(buffer)self.postMessage({type:'chunk',id:request.id,text:buffer});
  self.postMessage({type:'exported',id:request.id,rows:result.sourceRows});
}
self.onmessage=async event=>{
  const request=event.data||{},id=request.id;
  if(!['page','export'].includes(request.type))return;
  let lastBytes=-Infinity,lastPass=0;
  const onProgress=progress=>{if(progress.pass!==lastPass||progress.bytes-lastBytes>=1024*1024||progress.bytes===progress.totalBytes){lastPass=progress.pass;lastBytes=progress.bytes;self.postMessage({type:'progress',id,...progress});}};
  try {
    if(request.type==='export')await exportEdited(request,onProgress);
    else {const page=await queryCsvSource(request.file,{...request,onProgress});self.postMessage({type:'result',id,page});}
  }catch(error){self.postMessage({type:'error',id,message:error.message||'Could not read this source.'});}
};
