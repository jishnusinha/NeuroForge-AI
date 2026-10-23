import {fitFullSourceModel,scoreFullSourceModel} from './fullSourceModel.js';

let session=null,busy=false,testAccessed=false;
self.onmessage=async event=>{
  const request=event.data||{},id=request.id;
  if(busy){self.postMessage({type:'error',id,message:'The full-source worker is busy.'});return;}
  busy=true;
  let previousPhase='',previousEpoch=0,previousBytes=-Infinity;
  const onProgress=p=>{if(p.phase!==previousPhase||p.epoch!==previousEpoch||p.bytes-previousBytes>=1024*1024||p.bytes===p.totalBytes){previousPhase=p.phase;previousEpoch=p.epoch;previousBytes=p.bytes;self.postMessage({type:'progress',id,...p});}};
  try {
    if(request.type==='fit'){
      if(session)throw new Error('Start a new investigation to change a fitted source or configuration.');
      const file=request.file,options=request.options,edits=request.edits;
      const result=await fitFullSourceModel(file,options,request.config,{edits,onProgress});
      session={file,options,edits,result};self.postMessage({type:'result',id,result});
    }else if(request.type==='test'){
      if(!session||testAccessed)throw new Error('The test partition is unavailable or has already been accessed.');
      testAccessed=true;
      const accessedAt=new Date().toISOString(),{file,options,edits,result}=session;
      const report=await scoreFullSourceModel(file,options,result,'test',{edits,onProgress});
      self.postMessage({type:'result',id,result:{candidateId:result.candidateId,accessedAt,report}});
    }else throw new Error('Unknown full-source worker operation.');
  }catch(reason){self.postMessage({type:'error',id,message:reason.message||'Full-source execution failed.',testAccessed});}
  finally{busy=false;}
};
