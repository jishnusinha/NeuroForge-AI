let sequence=0;
export function importCsvFile(file,{onProgress=()=>{},signal,delimiter='auto',quoteChar='"',encoding='utf-8',hasHeader=true,decimalSeparator='.',schemaOverrides={}}={}){
 return new Promise((resolve,reject)=>{
  const id=++sequence,worker=new Worker(new URL('./csvImportWorker.js',import.meta.url),{type:'module'});
  const finish=()=>{signal?.removeEventListener('abort',abort);worker.terminate();};
  const abort=()=>{worker.postMessage({type:'cancel',id});finish();reject(new DOMException('Import cancelled.','AbortError'));};
  if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=event=>{const message=event.data;if(message.id!==id)return;if(message.type==='progress'){onProgress(message);return;}finish();if(message.type==='result')resolve(message.summary);else{const error=new Error(message.message);error.diagnostics=message.diagnostics||[];reject(error);}};
  worker.onerror=event=>{finish();reject(new Error(event.message||'The CSV import worker stopped unexpectedly.'));};
  worker.postMessage({type:'parse',id,file,delimiter,quoteChar,encoding,hasHeader,decimalSeparator,schemaOverrides});
 });
}
