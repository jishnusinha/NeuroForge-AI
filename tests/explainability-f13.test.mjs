import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStudioRecipe } from '../client/src/ml/pipelineGraph.js';
import { executeStudioPipeline } from '../client/src/ml/pipelineExecutor.js';
import { createFeatureMatrix } from '../client/src/ml/modelWorkbench/featureMatrix.js';
import { fitWorkbenchModel, predictWorkbenchModel } from '../client/src/ml/modelWorkbench/models.js';
import { validateExplanationContext, validationSample, scoreExplanationRows } from '../client/src/ml/modelWorkbench/explainabilityContracts.js';
import { permutationImportance } from '../client/src/ml/modelWorkbench/permutationImportance.js';
import { explainLocalPrediction } from '../client/src/ml/modelWorkbench/localExplanations.js';
import { partialDependence } from '../client/src/ml/modelWorkbench/partialDependence.js';
import { sourceFeatureControls, sourceWhatIf } from '../client/src/ml/modelWorkbench/whatIfDiagnostics.js';
import { subgroupDiagnostics } from '../client/src/ml/modelWorkbench/subgroupDiagnostics.js';
import { createExplanationReceipt } from '../client/src/ml/modelWorkbench/explanationEvidence.js';

const binary = {
  headers:['signal','noise','category','label'],
  rows:Array.from({length:120},(_,i)=>({
    id:'private-row-'+i,
    signal:i<60 ? -3-(i%7)*0.16 : 3+(i%7)*0.16,
    noise:((i*37)%103)/17,
    category:i%2?'east':'west',
    label:i<60?0:1,
  })),
};
const regression = {
  headers:['x','z','target'],
  rows:Array.from({length:90},(_,i)=>({
    id:'r-'+i, x:(i%23)-11, z:Math.floor(i/8)-5,
    target:5+3*((i%23)-11)-2*(Math.floor(i/8)-5),
  })),
};
const multiclass = {
  headers:['x','y','label'],
  rows:Array.from({length:90},(_,i)=>{
    const c=i%3;
    return {id:'m-'+i,x:(c===1?8:0)+(i%4)/10,
      y:(c===2?8:0)+(i%5)/10,label:['alpha','beta','gamma'][c]};
  }),
};
function prepared(data,task='classification',features=null,withCategory=false){
  const recipe=defaultStudioRecipe(data);
  recipe.taskType=task;
  if(features)recipe.featureColumns=features;
  if(task==='regression')recipe.nodes=[];
  if(withCategory) {
    recipe.nodes.push({id:'categorical-encoding',type:'category.onehot',
      columns:['category'],enabled:true,options:{unknown:'allZero'}});
  }
  const plan=executeStudioPipeline(data,recipe);
  const matrix=createFeatureMatrix(plan);
  return {plan,matrix};
}

test('F13 rejects a mismatched model or test-row explanation requests',()=>{
  const {matrix}=prepared(binary,'classification',['signal','noise']);
  const model=fitWorkbenchModel(matrix,'logistic',{epochs:220,lambda:0.01});
  const validation=validateExplanationContext(matrix,model);
  assert.deepEqual(validation.map(row=>row.id),matrix.rows.filter(row=>row.split==='validation').map(row=>row.id));
  assert.throws(()=>validateExplanationContext(matrix,{...model,features:['noise','signal']}),/F13_MODEL_MATRIX_MISMATCH/);
  assert.throws(()=>explainLocalPrediction(matrix,model,matrix.membership.test[0]),/F13_VALIDATION_ROW_REQUIRED/);
  assert.throws(()=>scoreExplanationRows(matrix,model,matrix.rows.filter(row=>row.split==='test'),'accuracy'),/F13_VALIDATION_ONLY/);
  assert.throws(()=>validationSample(matrix,model,300),/F13_SAMPLE_BUDGET/);
});

test('F13 repeated permutation importance is deterministic and ranks the signal over noise',()=>{
  const {matrix}=prepared(binary,'classification',['signal','noise']);
  const model=fitWorkbenchModel(matrix,'logistic',{epochs:220,lambda:0.001});
  const snapshot=structuredClone(matrix);
  const options={metric:'accuracy',repeats:5,seed:72,maxRows:80};
  const first=permutationImportance(matrix,model,options);
  const second=permutationImportance(matrix,model,options);
  assert.deepEqual(first,second);
  assert.equal(first.status,'ok');
  assert.equal(first.scope,'validation');
  assert.equal(first.features.length,2);
  const signal=first.features.find(feature=>feature.name==='signal');
  const noise=first.features.find(feature=>feature.name==='noise');
  assert.ok(signal.meanImportance>noise.meanImportance,
    'the known discriminating signal should be more important than the irrelevant feature');
  assert.ok(signal.meanImportance>0);
  assert.deepEqual(matrix,snapshot);
  assert.ok(first.limitations.some(line=>/Correlated features/.test(line)));
});

test('F13 baseline has genuine zero permutation importance rather than fabricated importance',()=>{
  const {matrix}=prepared(binary,'classification',['signal','noise']);
  const model=fitWorkbenchModel(matrix,'baseline');
  const evidence=permutationImportance(matrix,model,{repeats:3});
  assert.ok(evidence.features.every(feature=>feature.meanImportance===0));
});

test('F13 ridge exact local contributions reconstruct numeric predictions',()=>{
  const {matrix}=prepared(regression,'regression',['x','z']);
  const model=fitWorkbenchModel(matrix,'ridge',{lambda:0.000001});
  const local=explainLocalPrediction(matrix,model,matrix.membership.validation[0]);
  assert.equal(local.method,'exact-linear-prediction');
  const total=local.intercept+local.contributions.reduce((sum,item)=>sum+item.contribution,0);
  assert.ok(Math.abs(total-local.modelOutput.predicted)<1e-9);
  assert.ok(Math.abs(local.reconstructed-local.modelOutput.predicted)<1e-9);
  assert.equal(local.contributions.length,2);
});

test('F13 logistic exact contributions reconstruct log-odds, not probabilities',()=>{
  const {matrix}=prepared(binary,'classification',['signal','noise']);
  const model=fitWorkbenchModel(matrix,'logistic',{epochs:180,lambda:0.01});
  const local=explainLocalPrediction(matrix,model,matrix.membership.validation[0]);
  assert.equal(local.method,'exact-log-odds');
  const sum=local.intercept+local.contributions.reduce((total,item)=>total+item.contribution,0);
  assert.ok(Math.abs(sum-local.total)<1e-9);
  assert.ok(Math.abs(local.reconstructed-local.modelOutput.probabilities[1])<1e-9);
  assert.match(local.explanation,/not additive probabilities/);
});

test('F13 kNN neighbor evidence summarizes class votes without revealing training IDs/vectors',()=>{
  const {matrix}=prepared(multiclass);
  const model=fitWorkbenchModel(matrix,'knn',{k:3});
  const local=explainLocalPrediction(matrix,model,matrix.membership.validation[0]);
  assert.equal(local.method,'nearest-training-neighbor-vote');
  assert.equal(local.neighbors.length,3);
  assert.equal(local.votes.reduce((sum,v)=>sum+v.count,0),3);
  assert.ok(local.neighbors.every(item=>!('id' in item)&&!('values' in item)&&item.distance>=0));
});

test('F13 PDP uses train-range grid and actual model predictions, with bounded validation background',()=>{
  const {matrix}=prepared(regression,'regression',['x','z']);
  const model=fitWorkbenchModel(matrix,'ridge',{lambda:0.1});
  const result=partialDependence(matrix,model,{feature:'x',gridSize:7,maxRows:15,iceRows:3,seed:13});
  assert.equal(result.scope,'validation');
  assert.equal(result.points.length,7);
  assert.equal(result.curves.length,3);
  const background=validationSample(matrix,model,15,13);
  const index=matrix.features.indexOf('x');
  const first=result.points[0];
  const direct=predictWorkbenchModel(model,background.map(row=>row.values.map((x,j)=>j===index?first.value:x)))
    .reduce((sum,p)=>sum+p.predicted,0)/background.length;
  assert.ok(Math.abs(first.meanPrediction-direct)<1e-10);
  assert.equal(result.trainingRange[0],Math.min(...matrix.rows.filter(row=>row.split==='train').map(row=>row.values[index])));
  assert.throws(()=>partialDependence(matrix,model,{feature:'not-a-feature'}),/F13_PDP_FEATURE_REQUIRED/);
});

test('F13 source what-if replays frozen F11 preprocessing and never modifies original data',()=>{
  const {plan,matrix}=prepared(binary,'classification',['signal','noise','category'],true);
  const model=fitWorkbenchModel(matrix,'knn',{k:3});
  const rowId=matrix.membership.validation[0];
  const before=structuredClone(plan.raw);
  const controls=sourceFeatureControls(plan,matrix);
  const numeric=controls.find(item=>item.name==='signal');
  const original=plan.raw.find(row=>row.id===rowId);
  const replacement=original.signal===numeric.min?numeric.max:numeric.min;
  const edited=sourceWhatIf(matrix,model,plan,rowId,{signal:replacement});
  assert.equal(edited.method,'frozen-source-pipeline-replay');
  assert.deepEqual(edited.modifiedFeatures,['signal']);
  assert.deepEqual(plan.raw,before);
  assert.throws(()=>sourceWhatIf(matrix,model,plan,rowId,{label:1}),/F13_WHAT_IF_INPUT_NOT_EDITABLE/);
  assert.throws(()=>sourceWhatIf(matrix,model,plan,rowId,{signal:numeric.max+100}),/F13_WHAT_IF_OUTSIDE_TRAIN_RANGE/);
  assert.throws(()=>sourceWhatIf(matrix,model,plan,matrix.membership.test[0],{signal:numeric.min}),/F13_VALIDATION_ROW_REQUIRED/);
  assert.throws(()=>sourceWhatIf(matrix,model,plan,rowId,{category:'secret-unseen'}),/F13_WHAT_IF_UNKNOWN_TRAIN_CATEGORY/);
});

test('F13 subgroup diagnostics use TRAIN median and validation-only measured samples',()=>{
  const {matrix}=prepared(binary,'classification',['signal','noise']);
  const model=fitWorkbenchModel(matrix,'logistic',{epochs:150,lambda:0.01});
  const evidence=subgroupDiagnostics(matrix,model,{feature:'signal',minSupport:5});
  assert.equal(evidence.scope,'validation');
  assert.equal(evidence.groups.reduce((sum,item)=>sum+item.count,0),evidence.sampleCount);
  const values=matrix.rows.filter(row=>row.split==='train').map(row=>row.values[0]).sort((a,b)=>a-b);
  assert.ok(evidence.boundary>=values[0]&&evidence.boundary<=values.at(-1));
  assert.ok(evidence.groups.every(group=>group.metricValue===null||
    group.metricValue>=0&&group.metricValue<=1));
  const unavailable=subgroupDiagnostics(matrix,model,{feature:'signal',minSupport:30});
  assert.ok(unavailable.groups.some(group=>group.status==='unavailable'));
});

test('F13 explanation export retains digests and aggregate evidence without raw data or row IDs',async()=>{
  const {matrix}=prepared(binary,'classification',['signal','noise','category'],true);
  const model=fitWorkbenchModel(matrix,'knn',{k:5});
  const sampleId=matrix.membership.validation[0];
  const local=explainLocalPrediction(matrix,model,sampleId);
  const importance=permutationImportance(matrix,model,{repeats:2,maxRows:20});
  const dependence=partialDependence(matrix,model,{feature:'signal',gridSize:5,iceRows:2});
  const whatIf=sourceWhatIf(matrix,model,{...prepared(binary,'classification',['signal','noise','category'],true).plan},sampleId,
    {signal:sourceFeatureControls(prepared(binary,'classification',['signal','noise','category'],true).plan,matrix).find(x=>x.name==='signal').min});
  const subgroups=subgroupDiagnostics(matrix,model,{feature:'signal',minSupport:2});
  const receipt=await createExplanationReceipt({
    matrix,model,candidateId:'candidate-example',importance,local,dependence,whatIf,subgroups,
  });
  assert.match(receipt.model.digest,/^[0-9a-f]{64}$/);
  assert.match(receipt.pipeline.digest,/^[0-9a-f]{64}$/);
  assert.equal(receipt.scope.name,'validation');
  assert.equal(receipt.local.method,'nearest-training-neighbor-vote');
  const serialized=JSON.stringify(receipt);
  assert.ok(!serialized.includes('private-row-'));
  assert.ok(!serialized.includes('training:'));
  assert.ok(!serialized.includes('neighbors'));
  assert.ok(!serialized.includes('preparedValue'));
  assert.ok(!serialized.includes('parameters'));
  assert.ok(!serialized.includes('"rows":'));
  assert.equal(receipt.dependence.points.length,5);
});

test('F13 cancellation and bounded-method configuration fail closed',()=>{
  const {matrix}=prepared(regression,'regression',['x','z']);
  const model=fitWorkbenchModel(matrix,'ridge',{lambda:0.01});
  assert.throws(()=>permutationImportance(matrix,model,{metric:'accuracy'}),/F13_UNSUPPORTED_METRIC/);
  assert.throws(()=>permutationImportance(matrix,model,{repeats:100}),/F13_PERMUTATION_BUDGET/);
  assert.throws(()=>permutationImportance(matrix,model,{signal:{aborted:true}}),/F13_ANALYSIS_CANCELLED/);
  assert.throws(()=>subgroupDiagnostics(matrix,model,{feature:'x',minSupport:100}),/F13_SUBGROUP_CONFIG/);
});
