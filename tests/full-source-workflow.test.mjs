import test from 'node:test';
import assert from 'node:assert/strict';
import {scanCsv} from '../client/src/ml/csvStream.js';
import {queryCsvSource,sourceComparator,CSV_SORT_BATCH} from '../client/src/ml/csvSourceQueries.js';
import {fitFullSourceModel,scoreFullSourceModel,sourcePartition,sourceSplitBlock} from '../client/src/ml/fullSourceModel.js';
import {fitWorkbenchModel,predictWorkbenchModel} from '../client/src/ml/modelWorkbench/models.js';
import {evaluateWorkbenchPredictions} from '../client/src/ml/modelWorkbench/metrics.js';
import {createFullSourceReceipt} from '../client/src/ml/modelRegistry/fullSourceReceipt.js';
import {verifySavedRun,replaySavedModel} from '../client/src/ml/modelRegistry/artifactValidator.js';
import {createResearchChartSpec} from '../client/src/visualization/researchChartSpec.js';
import {createResearchComparisonSnapshot} from '../client/src/ml/modelRegistry/reports.js';

const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const toFile=rows=>new Blob(['x,y,target\n'+rows.map(row=>[row.x??'',row.y??'',row.target].join(',')).join('\n')]);
const config={features:['x','y'],targetColumn:'target',task:'binary_classification',algorithm:'logistic',seed:42,splitPreset:'70/15/15',lambda:.1,epochs:3};

test('stream parser handles bytewise quotes, CRLF, UTF-8 and applies the source overlay',async()=>{
  const bytes=new TextEncoder().encode('\uFEFFname;value;note\r\n"a;é";1,25;"one\r\ntwo ""quotes"""\r\nlast;2,5;""');
  const file=new Blob([bytes]);file.stream=()=>new ReadableStream({start(controller){for(const byte of bytes)controller.enqueue(new Uint8Array([byte]));controller.close();}});
  const rows=[];await scanCsv(file,{delimiter:';',decimalSeparator:','},row=>{rows.push(row);},{edits:{'["source-1","value"]':7}});
  assert.equal(rows.length,2);assert.equal(rows[0].name,'a;é');assert.equal(rows[0].value,1.25);assert.equal(rows[0].note,'one\r\ntwo "quotes"');assert.equal(rows[1].value,7);
  const plain=[];await scanCsv(new Blob(['1\t2\n3\t4']),{hasHeader:false,delimiter:'tab'},row=>{plain.push(row);});assert.equal(plain.length,2);assert.equal(plain[0]['Column 1'],1);
  await assert.rejects(scanCsv(new Blob(['a,b\n1,"unclosed']),{},()=>{}),/not closed/);
  await assert.rejects(scanCsv(new Blob(['a,b\n1,2,3']),{},()=>{}),/expected 2/);
});

test('source sort matches a complete reference order through batch boundaries, edits and filters',async()=>{
  const rows=Array.from({length:24037},(_,i)=>({x:(i*8191)%3001,y:i,target:i%2})),file=toFile(rows);
  const edits={'["source-8","x"]':-500,'["source-9","x"]':null};
  const reference=rows.map((row,i)=>({value:i===8?-500:i===9?null:row.x,sourceRowNumber:i+1})).sort(sourceComparator('asc'));
  for(const start of [0,CSV_SORT_BATCH-50,CSV_SORT_BATCH,23990,25000]){
    const page=await queryCsvSource(file,{sort:{column:'x',direction:'asc'},start,pageSize:100,edits});
    assert.deepEqual(page.rows.map(row=>row.sourceRowNumber),reference.slice(start,start+100).map(row=>row.sourceRowNumber));
    assert.equal(page.matchedRows,rows.length);assert.ok(page.maxRetainedSortEntries<=CSV_SORT_BATCH);
  }
  const filtered=await queryCsvSource(file,{filter:{column:'x',operator:'less',value:0},sort:{column:'x'},edits});assert.equal(filtered.matchedRows,1);assert.equal(filtered.rows[0].id,'source-8');
  const mixed=await queryCsvSource(new Blob(['value,other\n10,a\n2,b\nhello,c\n,d\n2,e']),{sort:{column:'value',direction:'desc'}});
  assert.deepEqual(mixed.rows.map(row=>row.sourceRowNumber),[3,1,2,5,4]);
});

test('sorting a source beyond 500,000 rows retains a bounded heap and exact stable ordering',async()=>{
  const file=new Blob(['value,target\n'+Array.from({length:500021},(_,i)=>`${i%3},${i%2}`).join('\n')]);
  const page=await queryCsvSource(file,{start:0,pageSize:5,sort:{column:'value',direction:'desc'}});
  assert.equal(page.matchedRows,500021);assert.deepEqual(page.rows.map(row=>row.sourceRowNumber),[3,6,9,12,15]);assert.equal(page.maxRetainedSortEntries,5);
});

test('affine stratification is deterministic, disjoint and exact for each class including tiny classes',()=>{
  for(const count of [3,7,100,2049])for(const seed of [0,42,0xffffffff]){
    const block=sourceSplitBlock('a',count,'70/15/15',seed),counts={train:0,validation:0,test:0},ranks=new Set();
    for(let i=0;i<count;i++){ranks.add((block.multiplier*i+block.offset)%count);counts[sourcePartition(block,i)]++;}
    assert.equal(ranks.size,count);for(const part of Object.keys(counts))assert.equal(counts[part],block[part]);assert.deepEqual(block,sourceSplitBlock('a',count,'70/15/15',seed));
  }
  assert.throws(()=>sourceSplitBlock('rare',2,'70/15/15',42),/at least three/);
});

test('full-source logistic uses more than 2,000 rows, matches the F12 optimizer, and excludes held-out statistics',async()=>{
  const rows=Array.from({length:4200},(_,i)=>({x:i%17===0?null:(i%101)-50,y:(i*17)%73,target:i%2}));
  const fitConfig={...config,epochs:20};
  const edits={'["source-3001","x"]':400};
  const fitted=await fitFullSourceModel(toFile(rows),{},fitConfig,{edits});
  assert.equal(fitted.sourceRows,4200);assert.equal(fitted.counts.train,2940);assert.equal(fitted.model.trainingCount,2940);assert.equal(fitted.editedCells,1);
  const blocks=new Map(fitted.split.blocks.map(block=>[block.name,block])),ordinals=new Map();
  const matrix={features:config.features,task:fitted.task,rows:rows.map((row,i)=>{
    const ordinal=ordinals.get(row.target)||0;ordinals.set(row.target,ordinal+1);const split=sourcePartition(blocks.get(row.target),ordinal);
    return {id:`source-${i}`,values:[i===3001?400:row.x??fitted.pipeline.statistics[0].mean,row.y],target:row.target,split};
  })};
  const reference=fitWorkbenchModel(matrix,'logistic',fitConfig);
  for(let i=0;i<3;i++)near(fitted.model.parameters.weights[i],reference.parameters.weights[i]);
  const predictions=predictWorkbenchModel(reference,matrix.rows.filter(row=>row.split==='validation').map(row=>row.values));
  const metrics=evaluateWorkbenchPredictions(matrix,predictions,'validation').metrics;
  assert.deepEqual(fitted.validation.metrics,metrics);
  const changed=rows.map((row,i)=>matrix.rows[i].split==='train'?row:{...row,x:1e8,y:-1e8});
  const again=await fitFullSourceModel(toFile(changed),{},fitConfig,{edits});
  assert.deepEqual(again.pipeline,fitted.pipeline);assert.deepEqual(again.model,fitted.model);
  const testReport=await scoreFullSourceModel(toFile(rows),{},fitted,'test',{edits});assert.equal(testReport.count,fitted.counts.test);
  await assert.rejects(scoreFullSourceModel(toFile(changed),{},fitted,'test',{edits}),/differs from the fitted source/);
  const receipt=await createFullSourceReceipt(fitted,{title:'Whole source',includeArtifact:true,finalTest:{candidateId:fitted.candidateId,accessedAt:'2026-10-23T12:00:00.000Z',report:testReport}});
  assert.equal(receipt.finalTest.accessHistory.length,1);assert.equal(receipt.model.config.execution,'full_source_streaming_v1');assert.equal(receipt.model.artifact.trainingCount,2940);
  assert.equal((await verifySavedRun(receipt)).replayable,true);assert.equal((await replaySavedModel(receipt,[[0,4]])).length,1);
  const summary=await createFullSourceReceipt(fitted);assert.equal(summary.model.artifact,null);assert.equal(JSON.stringify(summary).includes('source-3001'),false);assert.equal(JSON.stringify(summary).includes('evidence'),false);
  const chart=await createResearchChartSpec({source:{kind:'f14-archive',receipts:[receipt,summary]},chartType:'research_leaderboard',metric:'accuracy'});
  assert.equal(chart.spec.evidence.rows.length,2);assert.equal(chart.spec.researchContext.comparisonScope.status,'comparable');
  const report=await createResearchComparisonSnapshot([receipt,summary],{metric:'accuracy'});assert.equal(report.runs[0].sourceExecution.sourceRows,4200);assert.equal(report.runs[0].model.artifact,undefined);assert.equal(JSON.stringify(report).includes('standardizer'),false);
});

test('full-source ridge and baselines fit complete train-only statistics with reproducible receipts',async()=>{
  const rows=Array.from({length:3300},(_,i)=>({x:i%29,y:(i*3)%7,target:5+2*(i%29)-.5*((i*3)%7)}));
  const cfg={...config,task:'regression',algorithm:'ridge',lambda:.000001};
  const fitted=await fitFullSourceModel(toFile(rows),{},cfg);
  assert.equal(fitted.sourceRows,3300);assert.ok(fitted.validation.metrics.rmse<.001);
  const baseline=await fitFullSourceModel(toFile(rows),{}, {...cfg,algorithm:'baseline'});
  const training=rows.filter((_,i)=>sourcePartition(fitted.split.blocks[0],i)==='train');
  near(baseline.model.parameters.mean,training.reduce((sum,row)=>sum+row.target,0)/training.length);
  const multi=await fitFullSourceModel(toFile(rows.map((row,i)=>({...row,target:i%3}))),{}, {...config,task:'multiclass_classification',algorithm:'baseline'});
  assert.equal(multi.task.classes.length,3);near(multi.model.parameters.probabilities.reduce((a,b)=>a+b,0),1);
  const a=await createFullSourceReceipt(fitted),b=await createFullSourceReceipt(await fitFullSourceModel(toFile(rows),{},cfg));assert.deepEqual(a.lineage,b.lineage);
  const receipt=await createFullSourceReceipt(fitted,{includeArtifact:true});assert.equal((await verifySavedRun(receipt)).replayable,true);
});

test('full-source validation rejects invalid rows beyond the sample boundary and all-missing train features',async()=>{
  const rows=Array.from({length:2200},(_,i)=>({x:i,y:i%13,target:i%2}));
  await assert.rejects(fitFullSourceModel(toFile(rows.map((row,i)=>i===2199?{...row,target:''}:row)),{},config),/missing target.*2200/);
  await assert.rejects(fitFullSourceModel(toFile(rows.map(row=>({...row,x:null}))),{},config),/no observed training/);
  await assert.rejects(fitFullSourceModel(toFile(rows.map((row,i)=>i===2199?{...row,y:'oops'}:row)),{},config),/nonnumeric.*2200/);
  const controller=new AbortController();controller.abort();await assert.rejects(fitFullSourceModel(toFile(rows),{},config,{signal:controller.signal}),{name:'AbortError'});
});
