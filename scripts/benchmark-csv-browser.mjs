import { chromium } from '@playwright/test';
import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const MiB=1024*1024,root=join('.artifacts','csv-performance','browser'),sizes=[1,10,50,100];
await mkdir(root,{recursive:true});
async function makeFixture(path,size){
 if(existsSync(path)&&statSync(path).size===size)return;
 const output=createWriteStream(path),header=Buffer.from('row_id,value,note\r\n');let bytes=0,id=0;
 if(!output.write(header))await once(output,'drain');bytes+=header.length;
 while(bytes<size){let chunk='',chunkBytes=0;while(chunkBytes<256*1024&&bytes+chunkBytes<size){const remaining=size-bytes-chunkBytes,prefix=`${id++},${(id%10000)/100},`,overhead=Buffer.byteLength(prefix)+2;if(remaining<overhead)break;const line=prefix+'x'.repeat(Math.min(180,remaining-overhead))+'\r\n';chunk+=line;chunkBytes+=Buffer.byteLength(line);}if(!chunkBytes)break;const buffer=Buffer.from(chunk);if(!output.write(buffer))await once(output,'drain');bytes+=buffer.length;}
 output.end();await once(output,'finish');
}
const clientRequire=createRequire(new URL('../client/package.json',import.meta.url));
const {createServer}=await import(pathToFileURL(clientRequire.resolve('vite')).href);
const server=await createServer({root:'client',configFile:'client/vite.config.js',server:{host:'127.0.0.1',port:0,strictPort:false},plugins:[{name:'csv-benchmark-fixtures',configureServer(vite){vite.middlewares.use('/bench-fixtures',(req,res,next)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=join(root,name);if(!/^fixture-(1|10|50|100)MiB\.csv$/.test(name)||!existsSync(file))return next();res.setHeader('content-type','text/csv');createReadStream(file).pipe(res);});}}]});
await server.listen();const address=server.httpServer.address(),base=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({args:['--enable-precise-memory-info']});const results=[];
try{
 const page=await browser.newPage();await page.goto(base);
 for(const sizeMiB of sizes){
  const filename=`fixture-${sizeMiB}MiB.csv`,path=join(root,filename);await makeFixture(path,sizeMiB*MiB);
  const result=await page.evaluate(async filename=>{
   const file=await fetch('/bench-fixtures/'+filename).then(response=>{if(!response.ok)throw new Error(`Fixture request failed: ${response.status}`);return response.blob();}).then(blob=>new File([blob],filename,{type:'text/csv'}));
   const baseline=performance.memory?.usedJSHeapSize??null,heapSamples=[];let lastProgress=null,longTaskTotal=0;
   const observer='PerformanceObserver'in window&&PerformanceObserver.supportedEntryTypes?.includes('longtask')?new PerformanceObserver(list=>{longTaskTotal+=list.getEntries().reduce((sum,entry)=>sum+entry.duration,0);}):null;
   observer?.observe({type:'longtask',buffered:true});
   const worker=new Worker(new URL('/src/ml/csvImportWorker.js',location.origin),{type:'module'}),id=Date.now();
   const started=performance.now(),done=new Promise((resolve,reject)=>{worker.onmessage=event=>{const message=event.data;if(message.id!==id)return;if(message.type==='progress'){lastProgress=message;heapSamples.push(performance.memory?.usedJSHeapSize??null);return;}worker.terminate();if(message.type==='result')resolve(message.summary);else reject(new Error(message.message));};worker.onerror=event=>{worker.terminate();reject(new Error(event.message));};});
   worker.postMessage({type:'parse',id,file,delimiter:'auto',quoteChar:'"',encoding:'utf-8',hasHeader:true,decimalSeparator:'.',schemaOverrides:{}});
   const summary=await done,elapsed=performance.now()-started;await new Promise(resolve=>setTimeout(resolve,100));observer?.disconnect();
   const finalHeap=performance.memory?.usedJSHeapSize??null,values=[baseline,finalHeap,...heapSamples].filter(Number.isFinite);
   let cancelLatencyMs=null,cancelAtBytes=null;
   if(filename==='fixture-100MiB.csv'){
    const cancelWorker=new Worker(new URL('/src/ml/csvImportWorker.js',location.origin),{type:'module'}),cancelId=id+1;
    cancelLatencyMs=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cancelWorker.terminate();reject(new Error('CSV worker did not reach cancellation threshold.'));},30000);cancelWorker.onmessage=event=>{const message=event.data;if(message.id!==cancelId)return;if(message.type==='progress'&&message.bytes>=5*1048576){cancelAtBytes=message.bytes;const cancelRequestedAt=performance.now();cancelWorker.terminate();clearTimeout(timeout);resolve(Number((performance.now()-cancelRequestedAt).toFixed(2)));}else if(message.type==='error'||message.type==='result'){clearTimeout(timeout);cancelWorker.terminate();reject(new Error('CSV worker completed before cancellation threshold.'));}};cancelWorker.onerror=event=>{clearTimeout(timeout);cancelWorker.terminate();reject(new Error(event.message));};cancelWorker.postMessage({type:'parse',id:cancelId,file,delimiter:'auto',quoteChar:'"',encoding:'utf-8',hasHeader:true,decimalSeparator:'.',schemaOverrides:{}});});
   }
   return {sourceRows:summary.sourceRows,bytes:file.size,parseMs:Number(elapsed.toFixed(1)),rowsPerSecond:Math.round(summary.sourceRows/(elapsed/1000)),baselineJsHeapMiB:baseline===null?null:Number((baseline/1048576).toFixed(2)),peakObservedJsHeapMiB:values.length?Number((Math.max(...values)/1048576).toFixed(2)):null,finalJsHeapMiB:finalHeap===null?null:Number((finalHeap/1048576).toFixed(2)),progressMessages:heapSamples.length,longTaskTotalMs:Number(longTaskTotal.toFixed(1)),longTaskScope:'main thread only',workerProgress:lastProgress,cancelLatencyMs,cancelAtBytes};
  },filename);
  results.push({sizeMiB,...result});console.log(`Browser measured ${sizeMiB} MiB CSV: ${result.parseMs} ms, ${result.sourceRows} rows.`);
 }
}finally{await browser.close();await server.close();}
await writeFile(join(root,'benchmark.json'),JSON.stringify({kind:'neuroforge-csv-browser-benchmark',schemaVersion:1,createdAt:new Date().toISOString(),environment:{browser:'Chromium via Playwright',platform:process.platform,architecture:process.arch,node:process.version},method:{parser:'client/src/ml/csvImportWorker.js using production CSV worker',maxSupportedSourceBytes:100*MiB,heap:'Chromium renderer main-thread performance.memory samples at worker progress boundaries; worker heap is not exposed by this API',longTasks:'PerformanceObserver main-thread long tasks only; worker-thread tasks are not exposed',cancellation:'synchronous Worker.terminate() call duration upon main-thread receipt of the production CSV worker progress message at >=5 MiB; does not measure OS thread cleanup'},measurements:results},null,2)+'\n');
for(const sizeMiB of sizes)await unlink(join(root,`fixture-${sizeMiB}MiB.csv`));
console.log(`Saved browser benchmark to ${join(root,'benchmark.json')}.`);
