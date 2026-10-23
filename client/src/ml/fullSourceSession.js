/** A worker owns the immutable file, edit snapshot, fitted model, and one-time test gate. */
export function createFullSourceSession(file,options,edits={}) {
  const worker=new Worker(new URL('./fullSourceModelWorker.js',import.meta.url),{type:'module'});
  let sequence=0,pending=null,closed=false;
  const close=()=>{closed=true;worker.terminate();if(pending){const item=pending;pending=null;item.cleanup();item.reject(new DOMException('Full-source execution cancelled.','AbortError'));}};
  worker.onmessage=event=>{const data=event.data;if(!pending||data.id!==pending.id)return;if(data.type==='progress'){pending.onProgress(data);return;}const item=pending;pending=null;item.cleanup();if(data.type==='result')item.resolve(data.result);else item.reject(Object.assign(new Error(data.message),{testAccessed:data.testAccessed}));};
  worker.onerror=event=>{if(pending){const item=pending;pending=null;item.cleanup();item.reject(new Error(event.message||'The model worker stopped unexpectedly.'));}closed=true;worker.terminate();};
  const execute=(payload,{onProgress=()=>{},signal}={})=>new Promise((resolve,reject)=>{
    if(closed||pending){reject(new Error('The full-source session is closed or busy.'));return;}
    if(signal?.aborted){close();reject(new DOMException('Full-source execution cancelled.','AbortError'));return;}
    const id=++sequence,abort=()=>close();
    pending={id,resolve,reject,onProgress,cleanup:()=>signal?.removeEventListener('abort',abort)};
    signal?.addEventListener('abort',abort,{once:true});
    try{worker.postMessage({...payload,id});}catch(reason){pending.cleanup();pending=null;reject(reason);close();}
  });
  return {fit:(config,callbacks)=>execute({type:'fit',file,options,edits,config},callbacks),evaluateTest:callbacks=>execute({type:'test'},callbacks),close};
}
