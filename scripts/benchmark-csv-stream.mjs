import { createReadStream, createWriteStream, existsSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { scanCsv } from '../client/src/ml/csvStream.js';

const MiB=1024*1024,output=join('.artifacts','csv-performance'),sizes=[1,10,50,100];
await mkdir(output,{recursive:true});
async function makeFixture(path,size){
  if(existsSync(path)&&statSync(path).size===size)return;
  const stream=createWriteStream(path),header=Buffer.from('row_id,value,note\r\n');let bytes=0,id=0;
  if(!stream.write(header))await once(stream,'drain');bytes+=header.length;
  while(bytes<size){let chunk='',chunkBytes=0;while(chunkBytes<256*1024&&bytes+chunkBytes<size){const remaining=size-bytes-chunkBytes,prefix=`${id++},${(id%10000)/100},`,overhead=Buffer.byteLength(prefix)+2;if(remaining<overhead)break;const line=prefix+'x'.repeat(Math.min(180,remaining-overhead))+'\r\n';chunk+=line;chunkBytes+=Buffer.byteLength(line);}if(!chunkBytes)break;const data=Buffer.from(chunk);if(!stream.write(data))await once(stream,'drain');bytes+=data.length;}
  stream.end();await once(stream,'finish');
}
function fileLike(path){const size=statSync(path).size;return {name:path,size,slice(start,end){return {arrayBuffer:async()=>{const buffer=Buffer.alloc(end-start),fd=openSync(path,'r');try{readSync(fd,buffer,0,buffer.length,start);}finally{closeSync(fd);}return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);}};},stream(){return Readable.toWeb(createReadStream(path,{highWaterMark:64*1024}));}};}
async function measure(path,sizeMiB){
  const file=fileLike(path),start=performance.now(),base=process.memoryUsage(),result=await scanCsv(file,{delimiter:',',encoding:'utf-8',hasHeader:true},()=>{},{}),elapsed=performance.now()-start,after=process.memoryUsage();
  let maxRss=Math.max(base.rss,after.rss),maxHeap=Math.max(base.heapUsed,after.heapUsed),cancelLatency=null,abortAt=null;
  const controller=new AbortController(),cancelStart=()=>{if(abortAt===null){abortAt=performance.now();controller.abort();}};
  try{await scanCsv(file,{delimiter:',',encoding:'utf-8',hasHeader:true},()=>{},{signal:controller.signal,onProgress:progress=>{maxRss=Math.max(maxRss,process.memoryUsage().rss);maxHeap=Math.max(maxHeap,process.memoryUsage().heapUsed);if(progress.bytes>=Math.max(MiB,Math.floor(file.size*.05)))cancelStart();}});}catch(error){if(error.name==='AbortError'&&abortAt!==null)cancelLatency=performance.now()-abortAt;else throw error;}
  return {sizeMiB,bytes:file.size,sourceRows:result.sourceRows,parseMs:Number(elapsed.toFixed(2)),rowsPerSecond:Math.round(result.sourceRows/(elapsed/1000)),peakRssMiB:Number((maxRss/MiB).toFixed(2)),peakHeapMiB:Number((maxHeap/MiB).toFixed(2)),cancelLatencyMs:cancelLatency===null?null:Number(cancelLatency.toFixed(2)),browserLongTaskMs:null};
}
const measurements=[];
for(const sizeMiB of sizes){const path=join(output,`fixture-${sizeMiB}MiB.csv`);await makeFixture(path,sizeMiB*MiB);measurements.push(await measure(path,sizeMiB));console.log(`Measured ${sizeMiB} MiB streamed CSV.`);}
const report={kind:'neuroforge-csv-stream-benchmark',schemaVersion:1,createdAt:new Date().toISOString(),environment:{platform:process.platform,architecture:process.arch,node:process.version,cpu:process.env.PROCESSOR_IDENTIFIER||'unspecified',memoryLimit:'not set by harness'},method:{parser:'client/src/ml/csvStream.js',chunkBytes:64*1024,fullScanAndCancellation:true,heapIsProcessHeap:true,browserLongTasks:'not measured by this Node harness'},measurements};
await writeFile(join(output,'benchmark.json'),JSON.stringify(report,null,2)+'\n');
console.log('Saved benchmark to .artifacts/csv-performance/benchmark.json');
