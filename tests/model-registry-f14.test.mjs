import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStudioRecipe } from '../client/src/ml/pipelineGraph.js';
import { executeStudioPipeline } from '../client/src/ml/pipelineExecutor.js';
import { createFeatureMatrix } from '../client/src/ml/modelWorkbench/featureMatrix.js';
import { fitWorkbenchModel, predictWorkbenchModel } from '../client/src/ml/modelWorkbench/models.js';
import { evaluateWorkbenchPredictions } from '../client/src/ml/modelWorkbench/metrics.js';
import { explainLocalPrediction } from '../client/src/ml/modelWorkbench/localExplanations.js';
import { createExplanationReceipt } from '../client/src/ml/modelWorkbench/explanationEvidence.js';
import { createRunReceipt, validateRunReceipt } from '../client/src/ml/modelRegistry/runContracts.js';
import { compareRunReceipts } from '../client/src/ml/modelRegistry/comparability.js';
import { replaySavedModel, verifySavedRun } from '../client/src/ml/modelRegistry/artifactValidator.js';
import { reviseRunMetadata, attachExplanationToRun } from '../client/src/ml/modelRegistry/runLifecycle.js';
import { createRunResearchReport } from '../client/src/ml/modelRegistry/reports.js';
import { enableMemoryStorageForTests } from '../client/src/services/localRepository.js';
import { saveF14Run, getF14Run, listF14Runs, deleteF14Run } from '../client/src/services/modelRegistryRepository.js';

const data={
  headers:['feature_one','feature_two','label'],
  rows:Array.from({length:60},(_,i)=>({
    id:'private-observation-'+i,
    feature_one:i<30?-2-(i%11)/5:2+(i%11)/5,
    feature_two:((i*13)%41)/12,
    label:i<30?0:1,
  })),
};
const regression={
  headers:['age','spend','target'],
  rows:Array.from({length:60},(_,i)=>({
    id:'regression-observation-'+i,
    age:i%17,spend:Math.floor(i/4)-6,
    target:7+3*(i%17)-2*(Math.floor(i/4)-6),
  })),
};
function make(dataSet=data,task='classification'){
  const recipe=defaultStudioRecipe(dataSet);
  recipe.taskType=task;
  if(task==='regression')recipe.nodes=[];
  const plan=executeStudioPipeline(dataSet,recipe);
  return {plan,matrix:createFeatureMatrix(plan)};
}
function candidate(matrix,algorithm='logistic',options={lambda:.01,epochs:140,k:3}){
  const model=fitWorkbenchModel(matrix,algorithm,options);
  const rows=matrix.rows.filter(row=>row.split==='validation');
  const validation=evaluateWorkbenchPredictions(matrix,predictWorkbenchModel(model,rows.map(row=>row.values)),'validation');
  return {id:'candidate-'+algorithm,algorithm,options,model,validation};
}
const context=make();
const baseCandidate=candidate(context.matrix);
const receipt=(overrides={})=>createRunReceipt({
  matrix:context.matrix,plan:context.plan,candidate:baseCandidate,title:'Classification study',
  ...overrides,
});

test('F14 research receipts hash source, split, model, feature order and fitted pipeline without raw rows',async()=>{
  const doc=await receipt();
  validateRunReceipt(doc);
  assert.match(doc.runId,/^[a-zA-Z0-9_-]{8,100}$/);
  assert.equal(doc.kind,'neuroforge-f14-run');
  assert.equal(doc.validation.count,context.matrix.membership.validation.length);
  assert.equal(doc.model.storageMode,'receipt_only');
  assert.equal(doc.model.artifact,null);
  assert.ok(Object.values(doc.lineage).every(value=>/^[0-9a-f]{64}$/.test(value)));
  const serial=JSON.stringify(doc);
  assert.ok(!serial.includes('private-observation-'));
  assert.ok(!serial.includes('"rows"'));
  assert.ok(!serial.includes('"parameters"'));
  assert.ok(!serial.includes('"evidence"'));
  assert.equal(doc.finalTest.accessHistory.length,0);
});

test('F14 same evaluation population compares candidates even when their model/pipeline differs',async()=>{
  const a=await receipt();
  const alternate=candidate(context.matrix,'baseline');
  const b=await createRunReceipt({matrix:context.matrix,plan:context.plan,candidate:alternate,title:'Majority baseline'});
  const result=compareRunReceipts(a,b,'accuracy');
  assert.equal(result.status,'comparable');
  assert.equal(result.metric,'accuracy');
  assert.ok(result.betterRunId===a.runId||result.betterRunId===null);
  assert.throws(()=>compareRunReceipts(a,b,'not_a_metric'),/F14_UNKNOWN_COMPARISON_METRIC/);
});

test('F14 mismatched source datasets or split membership cannot be ranked',async()=>{
  const a=await receipt();
  const changed={...data,rows:data.rows.map((row,i)=>i===4?{...row,feature_two:9999}:row)};
  const {plan,matrix}=make(changed);
  const b=await createRunReceipt({matrix,plan,candidate:candidate(matrix),title:'Other source'});
  const comparison=compareRunReceipts(a,b,'accuracy');
  assert.equal(comparison.status,'contextual');
  assert.equal(comparison.betterRunId,null);
  assert.match(comparison.reasons.join(' '),/Different source/);
  const forged={...a,lineage:{...a.lineage,splitDigest:'a'.repeat(64)}};
  const splitMismatch=compareRunReceipts(a,forged,'accuracy');
  assert.equal(splitMismatch.status,'contextual');
  assert.match(splitMismatch.reasons.join(' '),/Different train/);
});

test('F14 task mismatch, undefined metric and metric definition invalidity prevent rankings',async()=>{
  const a=await receipt();
  const {matrix,plan}=make(regression,'regression');
  const regressionCandidate=candidate(matrix,'ridge');
  const b=await createRunReceipt({matrix,plan,candidate:regressionCandidate,title:'Regression'});
  assert.equal(compareRunReceipts(a,b,'accuracy').status,'unavailable');
  const noScore={...a,validation:{...a.validation,metrics:{...a.validation.metrics,accuracy:null}}};
  assert.equal(compareRunReceipts(a,noScore,'accuracy').status,'unavailable');
  assert.throws(()=>validateRunReceipt({...a,validation:{...a.validation,metricDefinitionVersion:100}}),/F14_INVALID_RUN_RECEIPT/);
});

test('F14 only explicit final-test access adds an immutable event; update keeps original run identity',async()=>{
  const first=await receipt();
  const testRows=context.matrix.rows.filter(row=>row.split==='test');
  const report=evaluateWorkbenchPredictions(context.matrix,
    predictWorkbenchModel(baseCandidate.model,testRows.map(row=>row.values)),'test');
  const access={candidateId:baseCandidate.id,report,accessedAt:'2026-10-20T09:00:00.000Z'};
  const updated=await receipt({finalTest:access,existing:first});
  assert.equal(updated.runId,first.runId);
  assert.equal(updated.finalTest.accessHistory.length,1);
  assert.equal(updated.finalTest.accessHistory[0].count,testRows.length);
  const second=await receipt({finalTest:access,existing:updated});
  assert.equal(second.finalTest.accessHistory.length,1);
  await assert.rejects(receipt({finalTest:{...access,accessedAt:'2026-10-20T09:03:00.000Z'},existing:updated}),
    /F14_TEST_ALREADY_RECORDED/);
});

test('F14 baseline/logistic/ridge fitted artifacts are opt-in, digest verified and replay predictions exactly',async()=>{
  for(const [ctx,algorithm] of [[context,'logistic'],[make(regression,'regression'),'ridge'],[context,'baseline']]){
    const c=candidate(ctx.matrix,algorithm);
    const doc=await createRunReceipt({matrix:ctx.matrix,plan:ctx.plan,candidate:c,title:'Reproducible',includeArtifact:true});
    assert.equal(doc.model.storageMode,'opt_in_artifact');
    assert.equal((await verifySavedRun(doc)).status,'verified');
    const testVectors=ctx.matrix.rows.filter(row=>row.split==='validation').slice(0,2).map(row=>row.values);
    assert.deepEqual(await replaySavedModel(doc,testVectors),predictWorkbenchModel(c.model,testVectors));
    const tampered={...doc,model:{...doc.model,artifact:{...doc.model.artifact,trainingCount:7777}}};
    await assert.rejects(verifySavedRun(tampered),/F14_MODEL_ARTIFACT_DIGEST_MISMATCH/);
    await assert.rejects(replaySavedModel(doc,[[1,2,3]]),/F14_INVALID_REPLAY_INPUTS/);
  }
});

test('F14 never saves kNN training vectors, even with explicit artifact opt-in',async()=>{
  const knn=candidate(context.matrix,'knn');
  await assert.rejects(createRunReceipt({matrix:context.matrix,plan:context.plan,candidate:knn,
    title:'Sensitive neighbor model',includeArtifact:true}),/F14_PRIVATE_TRAINING_VECTORS/);
  const doc=await createRunReceipt({matrix:context.matrix,plan:context.plan,candidate:knn,title:'kNN receipt'});
  assert.ok(!JSON.stringify(doc).includes('"training"'));
  assert.equal((await verifySavedRun(doc)).replayable,false);
  await assert.rejects(replaySavedModel(doc,[[1,2]]),/F14_RECEIPT_ONLY_NO_INFERENCE/);
});

test('F14 F13 explanation receipts attach only to the correct candidate and pipeline',async()=>{
  const doc=await receipt();
  const local=explainLocalPrediction(context.matrix,baseCandidate.model,context.matrix.membership.validation[0]);
  const explanation=await createExplanationReceipt({matrix:context.matrix,model:baseCandidate.model,
    candidateId:baseCandidate.id,local});
  const updated=attachExplanationToRun(doc,explanation);
  assert.equal(updated.explanations.length,1);
  assert.equal(doc.explanations.length,0);
  assert.ok(!JSON.stringify(updated).includes('private-observation-'));
  assert.throws(()=>attachExplanationToRun(doc,{...explanation,model:{...explanation.model,digest:'f'.repeat(64)}}),
    /F14_EXPLANATION_PROVENANCE_MISMATCH/);
});

test('F14 metadata edits preserve evidence and report uses only recorded measured values',async()=>{
  const first=await receipt();
  const edited=reviseRunMetadata(first,{title:'Revised study',tags:['checked','binary'],notes:'Observed stable behavior'});
  assert.equal(edited.title,'Revised study');
  assert.equal(edited.validation.metrics.accuracy,first.validation.metrics.accuracy);
  const markdown=createRunResearchReport([edited],{observations:'Validation only',limitations:'Single dataset'});
  assert.match(markdown,/Revised study/);
  assert.match(markdown,/Validation only/);
  assert.match(markdown,/not model training reproduction/);
  assert.ok(!markdown.includes('private-observation-'));
  assert.throws(()=>reviseRunMetadata(first,{title:''}),/F14_INVALID_RUN_RECEIPT/);
  assert.throws(()=>createRunResearchReport([]),/F14_REPORT_INVALID/);
});

test('F14 owner-scoped archive performs atomic revision checks, persists reopenable receipts and deletes safely',async()=>{
  enableMemoryStorageForTests();
  const prev=globalThis.localStorage;
  let current='f14-test-user-alpha';
  globalThis.localStorage={getItem:key=>key==='neuroforge_account_id'?current:null};
  try{
    const first=await receipt({title:'Persisted F14 model'});
    const saved=await saveF14Run(first,0);
    assert.equal(saved.revision,1);
    assert.equal((await getF14Run(first.runId)).title,'Persisted F14 model');
    assert.ok((await listF14Runs()).some(row=>row.runId===first.runId));
    await assert.rejects(saveF14Run(first,0),/REVISION_CONFLICT/);
    const revised=reviseRunMetadata(saved,{title:'Updated saved model',notes:'One note'});
    const updated=await saveF14Run(revised,saved.revision);
    assert.equal(updated.revision,2);
    assert.equal((await getF14Run(first.runId)).title,'Updated saved model');
    await assert.rejects(deleteF14Run(first.runId,1),/REVISION_CONFLICT/);
    current='f14-test-user-beta';
    assert.equal((await listF14Runs()).length,0);
    assert.equal(await getF14Run(first.runId),null);
    current='f14-test-user-alpha';
    await deleteF14Run(first.runId,updated.revision);
    assert.equal(await getF14Run(first.runId),null);
  }finally{globalThis.localStorage=prev;}
});

test('F14 contract blocks forged artifact flags, invalid metadata, duplicate tags and overflow',async()=>{
  const a=await receipt();
  assert.throws(()=>validateRunReceipt({...a,model:{...a.model,storageMode:'opt_in_artifact'}}),
    /F14_INVALID_REPLAY_ARTIFACT/);
  assert.throws(()=>validateRunReceipt({...a,tags:['same','same']}),/F14_INVALID_RUN_RECEIPT/);
  assert.throws(()=>validateRunReceipt({...a,notes:'x'.repeat(3100)}),/F14_INVALID_RUN_RECEIPT/);
  await assert.rejects(receipt({includeArtifact:true,candidate:candidate(context.matrix,'knn')}),/F14_PRIVATE_TRAINING_VECTORS/);
});
