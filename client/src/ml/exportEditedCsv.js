let sequence=0;
export function exportEditedCsv(file,options,summary,edits,{signal,onProgress=()=>{}}={}){
  return new Promise((resolve,reject)=>{
    const id=++sequence,worker=new Worker(new URL('./csvPageWorker.js',import.meta.url),{type:'module'}),parts=[];let totalBytes=0;
    const finish=()=>{signal?.removeEventListener('abort',abort);worker.terminate();};
    const abort=()=>{worker.postMessage({type:'cancel',id});finish();reject(new DOMException('Export cancelled.','AbortError'));};
    if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=event=>{const message=event.data;if(message.id!==id)return;if(message.type==='progress'){onProgress(message);return;}if(message.type==='chunk'){parts.push(message.text);totalBytes+=message.text.length;onProgress({bytes:totalBytes});return;}finish();if(message.type==='exported')resolve({blob:new Blob(parts,{type:'text/csv;charset=utf-8'}),rows:message.rows});else reject(new Error(message.message||'Could not export edited source.'));};
    worker.onerror=event=>{finish();reject(new Error(event.message||'The CSV export worker stopped unexpectedly.'));};
    worker.postMessage({type:'export',id,file,delimiterChoice:options.delimiter||'auto',quoteChar:options.quoteChar||'"',encoding:options.encoding||'utf-8',hasHeader:options.hasHeader!==false,decimalSeparator:options.decimalSeparator||'.',schemaOverrides:options.schemaOverrides||{},edits,originalHeaders:summary.originalHeaders});
  });
}
