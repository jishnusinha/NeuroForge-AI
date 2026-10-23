let sequence=0;
export function readCsvPage(file,options={}){
  return new Promise((resolve,reject)=>{
    const id=++sequence,worker=new Worker(new URL('./csvPageWorker.js',import.meta.url),{type:'module'});
    const finish=()=>{options.signal?.removeEventListener('abort',abort);worker.terminate();};
    const abort=()=>{worker.postMessage({type:'cancel',id});finish();reject(new DOMException('Page read cancelled.','AbortError'));};
    if(options.signal?.aborted)return abort();options.signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=event=>{const message=event.data;if(message.id!==id)return;if(message.type==='progress'){options.onProgress?.(message);return;}finish();if(message.type==='result')resolve(message.page);else reject(new Error(message.message));};
    worker.onerror=event=>{finish();reject(new Error(event.message||'The CSV page worker stopped unexpectedly.'));};
    worker.postMessage({type:'page',id,file,start:Math.max(0,Math.floor(options.start||0)),pageSize:Math.max(1,Math.min(500,Math.floor(options.pageSize||100))),delimiterChoice:options.delimiter||'auto',quoteChar:options.quoteChar||'"',encoding:options.encoding||'utf-8',hasHeader:options.hasHeader!==false,decimalSeparator:options.decimalSeparator||'.',schemaOverrides:options.schemaOverrides||{},filter:options.filter||null,sort:options.sort||null,edits:options.edits||{},expectedRows:options.expectedRows||0});
  });
}
