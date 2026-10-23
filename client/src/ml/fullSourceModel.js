import {digest} from '../../../shared/domain.mjs';
import {scanCsv,csvOptions} from './csvStream.js';
import {validateSourceEdits} from './sourceEdits.js';
import {predictWorkbenchModel} from './modelWorkbench/models.js';

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const ratios={'70/15/15':[.7,.15],'80/10/10':[.8,.1],'60/20/20':[.6,.2]};
const taskTypes=['binary_classification','multiclass_classification','regression'];
const key=value=>JSON.stringify(value);
const sigmoid=value=>1/(1+Math.exp(-Math.max(-35,Math.min(35,value))));
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const moment=()=>({count:0,mean:0,m2:0});
function observe(stat,value){stat.count++;const delta=value-stat.mean;stat.mean+=delta/stat.count;stat.m2+=delta*(value-stat.mean);if(!finite(stat.mean)||!finite(stat.m2))throw new Error('Values exceed the stable numerical range; rescale the source before fitting.');}
function seedHash(seed,text){let value=seed>>>0;for(const ch of text)value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;return value>>>0;}
function gcd(a,b){while(b){const next=a%b;a=b;b=next;}return a;}
export function sourceSplitBlock(name,count,preset,seed){
  if(!Number.isSafeInteger(count)||count<3)throw new Error(`Each target class needs at least three rows for disjoint train, validation and test partitions (${String(name)} has ${count}).`);
  const [trainRatio,valRatio]=ratios[preset]??[];
  if(!trainRatio||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid split preset or seed.');
  const validation=Math.max(1,Math.floor(count*valRatio)),train=Math.min(count-validation-1,Math.max(1,Math.floor(count*trainRatio)));
  let multiplier=1+seedHash(seed,key(name))%Math.min(count-1,65535);
  while(gcd(multiplier,count)!==1)multiplier++;
  return {name,count,train,validation,test:count-train-validation,multiplier,offset:seedHash(seed^0x9e3779b9,key(name))%count};
}
export function sourcePartition(block,ordinal){const rank=(block.multiplier*ordinal+block.offset)%block.count;return rank<block.train?'train':rank<block.train+block.validation?'validation':'test';}
function partitioner(split,task){
  const blocks=new Map(split.blocks.map(block=>[key(block.name),block])),ordinals=new Map();
  return row=>{const id=task.type==='regression'?'all':key(row[task.targetColumn]),block=blocks.get(task.type==='regression'?key('all'):id);if(!block)throw new Error('Source target schema changed.');const ordinal=ordinals.get(id)||0;ordinals.set(id,ordinal+1);return sourcePartition(block,ordinal);};
}
function validateConfig(config){
  const {features,targetColumn,task='binary_classification',algorithm='logistic',seed=42,splitPreset='70/15/15',lambda=.1,epochs=20}=config;
  if(!Array.isArray(features)||features.length<1||features.length>20||new Set(features).size!==features.length||features.some(name=>typeof name!=='string'||!name)||!targetColumn||features.includes(targetColumn))throw new Error('Choose 1–20 different numeric features and a separate target.');
  if(!taskTypes.includes(task)||!['baseline','ridge','logistic'].includes(algorithm)||algorithm==='ridge'&&task!=='regression'||algorithm==='logistic'&&task!=='binary_classification')throw new Error('Choose an algorithm compatible with the target task.');
  if(!ratios[splitPreset]||!Number.isInteger(seed)||seed<0||seed>0xffffffff||!finite(lambda)||lambda<.000001||lambda>10||!Number.isInteger(epochs)||epochs<1||epochs>400)throw new Error('Invalid full-source model parameters.');
  return {features:[...features],targetColumn,task,algorithm,seed,splitPreset,lambda,epochs};
}
function validateRow(row,cfg){
  const label=row[cfg.targetColumn];
  if(label===null||label===undefined||label===''||!(typeof label==='string'||finite(label))||cfg.task==='regression'&&!finite(label))throw new Error(`Invalid or missing target at source row ${row.sourceRowNumber}; targets are never imputed.`);
  for(const feature of cfg.features){const value=row[feature];if(value!==null&&value!==undefined&&!finite(value))throw new Error(`Feature ${feature} contains a nonnumeric value at source row ${row.sourceRowNumber}. Choose numeric inputs.`);}
}
function solve(matrix,rhs){
  const a=matrix.map((row,i)=>[...row,rhs[i]]),n=a.length;
  for(let col=0;col<n;col++){
    let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    if(Math.abs(a[pivot][col])<1e-12)throw new Error('The ridge system is singular.');
    [a[pivot],a[col]]=[a[col],a[pivot]];const divisor=a[col][col];
    for(let j=col;j<=n;j++)a[col][j]/=divisor;
    for(let row=0;row<n;row++)if(row!==col){const factor=a[row][col];for(let j=col;j<=n;j++)a[row][j]-=factor*a[col][j];}
  }
  return a.map(row=>row[n]);
}
export function streamedMetrics(task){
  let count=0,absolute=0,squared=0;const target=moment(),confusion=task.classes.map(()=>task.classes.map(()=>0)),evidence=[];
  return {
    add(row,prediction){
      count++;const actual=row[task.targetColumn],predicted=prediction.predicted;
      if(task.type==='regression'){if(!finite(predicted))throw new Error('Nonfinite regression prediction.');observe(target,actual);absolute+=Math.abs(actual-predicted);squared+=(actual-predicted)**2;if(!finite(squared)||!finite(absolute))throw new Error('Prediction errors exceed the numerical range.');}
      else {const a=task.classes.indexOf(actual),p=task.classes.indexOf(predicted);if(a<0||p<0)throw new Error('Prediction class mismatch.');confusion[a][p]++;}
      if(evidence.length<20)evidence.push({id:row.id,target:actual,predicted,...(task.type==='regression'?{residual:actual-predicted}:{correct:actual===predicted})});
    },
    report(split){
      if(!count)throw new Error('The evaluation partition is empty.');
      if(task.type==='regression')return {task:task.type,split,count,metrics:{mae:absolute/count,mse:squared/count,rmse:Math.sqrt(squared/count),r2:target.m2>1e-12?1-squared/target.m2:null},evidence};
      const perClass=task.classes.map((name,i)=>{const support=confusion[i].reduce((a,b)=>a+b,0),predictedCount=confusion.reduce((sum,row)=>sum+row[i],0),tp=confusion[i][i],precision=predictedCount?tp/predictedCount:null,recall=support?tp/support:null;return {name,support,precision,recall,f1:precision===null||recall===null||precision+recall===0?null:2*precision*recall/(precision+recall)};});
      const all=perClass.every(item=>item.f1!==null),positive=perClass.length===2?perClass[1]:null;
      return {task:task.type,split,count,confusion,perClass,metrics:{accuracy:confusion.reduce((sum,row,i)=>sum+row[i],0)/count,macroF1:all?perClass.reduce((sum,item)=>sum+item.f1,0)/perClass.length:null,weightedF1:all?perClass.reduce((sum,item)=>sum+item.f1*item.support,0)/count:null,precision:positive?.precision??null,recall:positive?.recall??null,f1:positive?.f1??null},evidence};
    },
  };
}

/** SHA-256 hash chain with fixed 1 MiB boundaries; not a standard file SHA-256. */
export async function fullSourceDigest(file,options,edits,{signal,onProgress=()=>{}}={}) {
  let previous=new Uint8Array(32);
  for(let offset=0;offset<file.size;offset+=1024*1024){
    signal?.throwIfAborted();const chunk=new Uint8Array(await file.slice(offset,offset+1024*1024).arrayBuffer()),input=new Uint8Array(32+chunk.length);input.set(previous);input.set(chunk,32);
    previous=new Uint8Array(await crypto.subtle.digest('SHA-256',input));onProgress({phase:'Source fingerprint',bytes:Math.min(offset+chunk.length,file.size),totalBytes:file.size});
  }
  return digest({kind:'csv-sha256-chain-v1',chunkBytes:1024*1024,bytes:file.size,chain:Array.from(previous),options:csvOptions(options),edits});
}

/** All successful source rows participate; only O(features² + classes²) state is retained. */
export async function fitFullSourceModel(file,options,config,{edits={},onProgress=()=>{},signal}={}) {
  const cfg=validateConfig(config);validateSourceEdits(edits);
  const scan=(phase,consume,extra={})=>scanCsv(file,options,consume,{edits,signal,onHeaders:headers=>{if([...cfg.features,cfg.targetColumn].some(name=>!headers.includes(name)))throw new Error('A chosen model column is absent from this source.');},onProgress:p=>onProgress({...p,phase,...extra})});
  const classes=new Map();let sourceRows=0;
  await scan('Validate complete source',row=>{validateRow(row,cfg);sourceRows++;if(cfg.task!=='regression'){const label=row[cfg.targetColumn];classes.set(label,(classes.get(label)||0)+1);if(classes.size>12)throw new Error('Classification supports at most 12 target classes.');}});
  if(cfg.task==='binary_classification'&&classes.size!==2||cfg.task==='multiclass_classification'&&classes.size<2)throw new Error('The selected classification task does not match the complete target vocabulary.');
  const ordered=[...classes.keys()].sort((a,b)=>typeof a===typeof b?(typeof a==='number'?a-b:a<b?-1:a>b?1:0):typeof a==='number'?-1:1);
  const task={type:cfg.task,targetColumn:cfg.targetColumn,classes:ordered};
  const split={schemaVersion:1,method:cfg.task==='regression'?'affine_source_order_v1':'stratified_affine_source_order_v1',seed:cfg.seed,preset:cfg.splitPreset,
    blocks:cfg.task==='regression'?[sourceSplitBlock('all',sourceRows,cfg.splitPreset,cfg.seed)]:ordered.map(name=>sourceSplitBlock(name,classes.get(name),cfg.splitPreset,cfg.seed))};
  const counts=Object.fromEntries(['train','validation','test'].map(part=>[part,split.blocks.reduce((sum,block)=>sum+block[part],0)]));
  const stats=cfg.features.map(()=>moment()),labelStat=moment(),classCounts=ordered.map(()=>0),which=partitioner(split,task);
  await scan('Fit training preprocessing',row=>{if(which(row)!=='train')return;cfg.features.forEach((name,i)=>{if(finite(row[name]))observe(stats[i],row[name]);});if(cfg.task==='regression')observe(labelStat,row[cfg.targetColumn]);else classCounts[ordered.indexOf(row[cfg.targetColumn])]++;});
  if(stats.some(stat=>!stat.count))throw new Error('A selected feature has no observed training values; remove it before fitting.');
  const mean=stats.map(stat=>stat.mean),scale=stats.map(stat=>{const value=Math.sqrt(stat.m2/counts.train);return value>1e-12?value:1;});
  const pipeline={kind:'neuroforge-full-source-preprocessing',schemaVersion:1,features:cfg.features,missing:'training_mean',scaling:'training_population_standardize_after_imputation',trainingCount:counts.train,
    statistics:stats.map((stat,i)=>({feature:cfg.features[i],observed:stat.count,missing:counts.train-stat.count,mean:stat.mean,scale:scale[i]}))};
  const vector=row=>cfg.features.map((name,i)=>finite(row[name])?row[name]:mean[i]);
  const x=row=>[1,...vector(row).map((value,i)=>(value-mean[i])/scale[i])];
  const model={schemaVersion:1,kind:'neuroforge-f12-model',algorithm:cfg.algorithm,task:cfg.task,classes:ordered,features:cfg.features,trainingCount:counts.train,parameters:{}};
  if(cfg.algorithm==='baseline')model.parameters=cfg.task==='regression'?{mean:labelStat.mean}:{probabilities:classCounts.map(n=>n/counts.train),majority:classCounts.indexOf(Math.max(...classCounts))};
  const p=cfg.features.length+1;
  if(cfg.algorithm==='ridge'){
    const gram=Array.from({length:p},()=>Array(p).fill(0)),rhs=Array(p).fill(0),part=partitioner(split,task);
    await scan('Fit ridge on complete training partition',row=>{if(part(row)!=='train')return;const v=x(row);for(let i=0;i<p;i++){rhs[i]+=v[i]*row[cfg.targetColumn];for(let j=0;j<p;j++)gram[i][j]+=v[i]*v[j];}});
    for(let i=1;i<p;i++)gram[i][i]+=cfg.lambda*counts.train;
    model.parameters={standardizer:{mean,scale},weights:solve(gram,rhs),lambda:cfg.lambda};
  }
  if(cfg.algorithm==='logistic'){
    const weights=Array(p).fill(0);
    for(let epoch=0;epoch<cfg.epochs;epoch++){
      const gradient=Array(p).fill(0),part=partitioner(split,task);
      await scan('Fit logistic on complete training partition',row=>{if(part(row)!=='train')return;const v=x(row),error=sigmoid(dot(weights,v))-Number(row[cfg.targetColumn]===ordered[1]);for(let j=0;j<p;j++)gradient[j]+=error*v[j];},{epoch:epoch+1,epochs:cfg.epochs});
      for(let j=0;j<p;j++)weights[j]-=.25*(gradient[j]/counts.train+(j?cfg.lambda*weights[j]:0));
    }
    model.parameters={standardizer:{mean,scale},weights,lambda:cfg.lambda,epochs:cfg.epochs};
  }
  if(model.parameters.weights?.some(value=>!finite(value)))throw new Error('Model fitting produced nonfinite coefficients.');
  const result={kind:'neuroforge-full-source-fit',schemaVersion:1,candidateId:crypto.randomUUID(),config:cfg,task,features:cfg.features,sourceRows,counts,split,pipeline,model,
    sourceDigest:await fullSourceDigest(file,options,edits,{signal,onProgress}),editedCells:Object.keys(edits).length,validation:null};
  result.validation=await scoreFullSourceModel(file,options,result,'validation',{edits,onProgress,signal});
  return result;
}

export async function scoreFullSourceModel(file,options,result,scope,{edits={},onProgress=()=>{},signal}={}) {
  if(!['validation','test'].includes(scope)||result?.kind!=='neuroforge-full-source-fit')throw new Error('Invalid full-source evaluation request.');
  validateSourceEdits(edits);
  if(scope==='test'&&await fullSourceDigest(file,options,edits,{signal,onProgress})!==result.sourceDigest)throw new Error('The source or edit overlay differs from the fitted source version.');
  const metrics=streamedMetrics(result.task),part=partitioner(result.split,result.task),stats=result.pipeline.statistics;
  await scanCsv(file,options,row=>{
    if(part(row)!==scope)return;
    const values=result.features.map((name,i)=>finite(row[name])?row[name]:stats[i].mean);
    const prediction=predictWorkbenchModel(result.model,[values])[0];metrics.add(row,prediction);
  },{edits,signal,onProgress:p=>onProgress({...p,phase:`Evaluate ${scope}`})});
  const report=metrics.report(scope);
  if(report.count!==result.counts[scope])throw new Error('Source membership changed since fitting.');
  return report;
}
