import { runModelSearch } from './crossValidation.js';
/** Terminating this module worker cancels the bounded synchronous search. */
self.onmessage=async event=>{
  const {requestId,plan,matrix,request}=event.data??{};
  try{
    const result=await runModelSearch(plan,matrix,request,
      progress=>self.postMessage({requestId,type:'progress',progress}));
    self.postMessage({requestId,type:'result',result});
  }catch(reason){
    self.postMessage({requestId,type:'error',message:reason?.message??'F15 search failed.'});
  }
};
