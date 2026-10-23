import {scanCsv,csvOptions} from './csvStream.js';

const PREVIEW_LIMIT=100,SAMPLE_LIMIT=2000;
const missing=value=>value==null||value==='';
function completeProfile(stats){return stats.map(s=>{const numeric=s.numeric>0&&s.numeric/Math.max(1,s.count)>=.8;return {name:s.name,type:numeric?'numeric':s.count?'categorical':'empty',count:s.count,missingCount:s.missing,min:numeric?s.min:null,max:numeric?s.max:null,mean:numeric?s.mean:null,variance:numeric&&s.numeric>1?s.m2/(s.numeric-1):numeric?0:null,scope:'whole_source_stream',status:'exact'};});}
self.onmessage=async event=>{
  const {type,id,file,...options}=event.data||{};if(type!=='parse')return;
  let headers=[],originalHeaders=[],stats=[],rows=0,seed=0x6d2b79f5,lastProgress=0,hashA=0x811c9dc5,hashB=0x9e3779b9;
  const preview=[],reservoir=[];
  try {
    const result=await scanCsv(file,options,record=>{
      const row=Object.create(null);row.id=record.id;
      for(let i=0;i<headers.length;i++){
        const name=headers[i],value=record[name],s=stats[i];row[name]=value;
        if(missing(value)){s.missing++;continue;}s.count++;
        if(typeof value==='number'&&Number.isFinite(value)){s.numeric++;const delta=value-s.mean;s.mean+=delta/s.numeric;s.m2+=delta*(value-s.mean);s.min=Math.min(s.min,value);s.max=Math.max(s.max,value);}
      }
      rows++;if(preview.length<PREVIEW_LIMIT)preview.push(row);
      if(reservoir.length<SAMPLE_LIMIT)reservoir.push(row);else{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const slot=seed%rows;if(slot<SAMPLE_LIMIT)reservoir[slot]=row;}
    },{
      onHeaders:(names,original)=>{headers=names;originalHeaders=original;if(headers.length<2)throw new Error('The file must contain at least two columns.');stats=headers.map(name=>({name,count:0,missing:0,numeric:0,mean:0,m2:0,min:Infinity,max:-Infinity}));},
      onBytes:bytes=>{for(const byte of bytes){hashA=Math.imul(hashA^byte,0x01000193)>>>0;hashB=(Math.imul(hashB^byte,0x85ebca6b)+0xc2b2ae35)>>>0;}},
      onProgress:progress=>{if(progress.bytes-lastProgress>=1024*1024){lastProgress=progress.bytes;self.postMessage({type:'progress',id,...progress});}},
    });
    if(rows<4)throw new Error('Include at least four data rows.');
    const cfg=csvOptions(options),hex=value=>value.toString(16).padStart(8,'0');
    self.postMessage({type:'result',id,summary:{fileName:file.name,fileBytes:file.size,
      sourceFingerprint:{kind:'noncryptographic_composite_fingerprint',algorithm:'two-32-bit-streaming-hashes',value:`${hex(hashA)}${hex(hashB)}:${file.size}`},
      headers,originalHeaders,sourceRows:rows,sourceColumns:headers.length,previewRows:preview,sampleRows:reservoir,profile:completeProfile(stats),
      previewLimit:PREVIEW_LIMIT,sampleLimit:SAMPLE_LIMIT,delimiter:result.delimiter==='\t'?'tab':result.delimiter,encoding:cfg.encoding,decimalSeparator:cfg.decimalSeparator,
      parseStatus:'complete',statisticsScope:'whole_source_stream',chartSample:{method:'seeded_reservoir_sample',seed:1831565813,rowCount:reservoir.length},localOnly:true,warnings:[]}});
  }catch(reason){self.postMessage({type:'error',id,message:reason.message||'Could not import this source.'});}
};
