import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStudioRecipe } from '../client/src/ml/pipelineGraph.js';
import { executeStudioPipeline } from '../client/src/ml/pipelineExecutor.js';
import { createFeatureMatrix } from '../client/src/ml/modelWorkbench/featureMatrix.js';
import { MODEL_DEFINITIONS, fitWorkbenchModel, predictWorkbenchModel } from '../client/src/ml/modelWorkbench/models.js';
import { createInnerFolds } from '../client/src/ml/modelSelection/folds.js';
import { prepareInnerFold } from '../client/src/ml/modelSelection/foldPipeline.js';
import { runModelSearch } from '../client/src/ml/modelSelection/crossValidation.js';
import { validateSearchRequest } from '../client/src/ml/modelSelection/searchManifest.js';
import { validateSelectionEvidence } from '../client/src/ml/modelSelection/selectionEvidence.js';
import { explainLocalPrediction } from '../client/src/ml/modelWorkbench/localExplanations.js';
import { createRunReceipt } from '../client/src/ml/modelRegistry/runContracts.js';
import { compareRunReceipts } from '../client/src/ml/modelRegistry/comparability.js';
import { createRunResearchReport } from '../client/src/ml/modelRegistry/reports.js';

const classes=['a','b','c'];
const tri={
  headers:['x','y','z','target'],
  rows:Array.from({length:120},(_,i)=>{
    const cls=i%3,delta=Math.floor(i/3)%13/30;
    return {id:'class-'+i,x:(cls===0?-4:cls===1?4:0)+delta,
      y:(cls===2?4:0)+delta,z:(i%17)/17,target:classes[cls]};
  }),
};
const reg={
  headers:['x','y','target'],
  rows:Array.from({length:96},(_,i)=>{
    const x=i%19-9,y=Math.floor(i/8)-5;
    return{id:'reg-'+i,x,y,target:2+3*x-2*y};
  }),
};
function prepared(data,task='classification'){
  const recipe=defaultStudioRecipe(data);recipe.taskType=task;
  if(task==='regression')recipe.nodes=[];
  const plan=executeStudioPipeline(data,recipe);
  return {plan,matrix:createFeatureMatrix(plan)};
}
const triReady=prepared(tri),regReady=prepared(reg,'regression');
const valRows=matrix=>matrix.rows.filter(row=>row.split==='validation');

test('F15 model registry advertises task-correct new families and preserves existing families',()=>{
  assert.deepEqual(MODEL_DEFINITIONS.filter(def=>def.tasks.includes('regression')).map(def=>def.id),
    ['baseline','ridge','cart','forest']);
  assert.deepEqual(MODEL_DEFINITIONS.filter(def=>def.tasks.includes('multiclass_classification')).map(def=>def.id),
    ['baseline','knn','softmax','cart','forest']);
  assert.throws(()=>fitWorkbenchModel(regReady.matrix,'softmax'),/F12_UNSUPPORTED_MODEL_TASK/);
});

test('F15 softmax learns three classes with stable probabilities and JSON replay',()=>{
  const model=fitWorkbenchModel(triReady.matrix,'softmax',{epochs:230,lambda:0.001});
  const rows=valRows(triReady.matrix);
  const predictions=predictWorkbenchModel(model,rows.map(row=>row.values));
  const correct=predictions.filter((p,i)=>p.predicted===rows[i].target).length;
  assert.ok(correct/rows.length>0.85,'softmax must learn separable multiclass fixture');
  assert.ok(predictions.every(p=>p.probabilities.every(x=>x>=0&&x<=1)&&
    Math.abs(p.probabilities.reduce((a,b)=>a+b,0)-1)<1e-12));
  assert.deepEqual(predictions,predictWorkbenchModel(JSON.parse(JSON.stringify(model)),rows.map(row=>row.values)));
  const explained=explainLocalPrediction(triReady.matrix,model,triReady.matrix.membership.validation[0]);
  assert.equal(explained.method,'exact-class-logit');
  assert.ok(Math.abs(explained.total-(explained.intercept+
    explained.contributions.reduce((s,c)=>s+c.contribution,0)))<1e-10);
});

test('F15 CART and random forest classify nontrivial multiclass data and replay reproducibly',()=>{
  const matrix=triReady.matrix;
  for(const algorithm of ['cart','forest']){
    const opts=algorithm==='cart'?{maxDepth:4,minLeaf:2,seed:21}:
      {maxDepth:5,minLeaf:2,trees:10,seed:21};
    const a=fitWorkbenchModel(matrix,algorithm,opts);
    const b=fitWorkbenchModel(matrix,algorithm,opts);
    assert.deepEqual(a,b);
    const rows=valRows(matrix);
    const predicted=predictWorkbenchModel(a,rows.map(row=>row.values));
    assert.ok(predicted.filter((p,i)=>p.predicted===rows[i].target).length/rows.length>0.85);
    assert.ok(predicted.every(p=>p.probabilities.length===3&&
      Math.abs(p.probabilities.reduce((s,x)=>s+x,0)-1)<1e-9));
    assert.deepEqual(predicted,predictWorkbenchModel(JSON.parse(JSON.stringify(a)),rows.map(row=>row.values)));
    const explained=explainLocalPrediction(matrix,a,matrix.membership.validation[0]);
    assert.equal(explained.method,algorithm==='cart'?'tree-decision-path':'forest-tree-aggregation');
  }
});

test('F15 CART and random forest regression predict finite useful numeric outcomes',()=>{
  for(const algorithm of ['cart','forest']){
    const model=fitWorkbenchModel(regReady.matrix,algorithm,
      algorithm==='cart'?{maxDepth:6,minLeaf:2}:{maxDepth:6,minLeaf:2,trees:12,seed:5});
    const rows=valRows(regReady.matrix);
    const preds=predictWorkbenchModel(model,rows.map(row=>row.values));
    assert.ok(preds.every(p=>Number.isFinite(p.predicted)&&p.probabilities===null));
    assert.ok(preds.reduce((s,p,i)=>s+Math.abs(p.predicted-rows[i].target),0)/rows.length<13);
  }
});

test('F15 inner fold generator uses only original training membership, stratifies classes and is deterministic',()=>{
  const {plan,matrix}=triReady;
  const raw=plan.raw.filter(row=>matrix.membership.train.includes(row.id));
  const folds=createInnerFolds(raw,matrix.membership.train,plan.recipe.targetColumn,
    matrix.task.type,{folds:5,seed:94});
  const again=createInnerFolds(raw,matrix.membership.train,plan.recipe.targetColumn,
    matrix.task.type,{folds:5,seed:94});
  assert.deepEqual(folds,again);
  const original=new Set(matrix.membership.train),visited=new Set();
  for(const fold of folds){
    assert.ok(fold.train.every(id=>original.has(id)));
    assert.ok(fold.validation.every(id=>original.has(id)&&!visited.has(id)));
    fold.validation.forEach(id=>visited.add(id));
    const classes=new Set(fold.validation.map(id=>raw.find(row=>row.id===id).target));
    assert.equal(classes.size,3);
    assert.equal(fold.test.length,0);
  }
  assert.equal(visited.size,original.size);
  assert.throws(()=>createInnerFolds(raw,matrix.membership.train,plan.recipe.targetColumn,
    matrix.task.type,{folds:4}),/F15_FOLD_CONFIGURATION/);
});

test('F15 fold preprocessing uses ONLY inner training values, refitting F11 imputation per fold',()=>{
  const base={
    headers:['x','y','label'],
    rows:Array.from({length:90},(_,i)=>({id:'missing-'+i,
      x:i%9===0?null:10+(i%13),y:(i%17)/2,label:i%2})),
  };
  const {plan,matrix}=prepared(base);
  const raw=plan.raw.filter(row=>matrix.membership.train.includes(row.id));
  const folds=createInnerFolds(raw,matrix.membership.train,'label',matrix.task.type,{folds:3,seed:42});
  const fold=folds[0];
  const actual=prepareInnerFold(plan,matrix,fold);
  const observed=plan.raw.filter(row=>fold.train.includes(row.id)&&Number.isFinite(row.x));
  const expected=observed.reduce((s,r)=>s+r.x,0)/observed.length;
  const fitted=actual.lineage.fittedPipeline.fittedNodes
    .find(node=>node.type==='numeric.impute').parameters.x.fill;
  assert.ok(Math.abs(fitted-expected)<1e-12);
  assert.equal(actual.rows.length,matrix.membership.train.length);
  assert.equal(actual.rows.some(row=>matrix.membership.test.includes(row.id)||
    matrix.membership.validation.includes(row.id)),false);
  assert.throws(()=>prepareInnerFold(plan,matrix,{
    ...fold,train:[...fold.train,matrix.membership.test[0]],
  }),/F15_OUTER_HOLDOUT_LEAK/);
});

test('F15 search is repeatable, samples only original training, and has a fixed fold digest',async()=>{
  const opts={algorithm:'softmax',folds:3,seed:87,metric:'accuracy',
    configs:[{lambda:0.01,epochs:90},{lambda:0.1,epochs:90}]};
  const first=await runModelSearch(triReady.plan,triReady.matrix,opts);
  const second=await runModelSearch(triReady.plan,triReady.matrix,opts);
  assert.deepEqual(first,second);
  assert.equal(first.status,'complete');
  assert.match(first.foldMembershipDigest,/^[a-f0-9]{64}$/);
  assert.equal(first.sourceTrainingCount,triReady.matrix.membership.train.length);
  assert.equal(first.totalFits,6);
  assert.ok(first.results.every(result=>result.foldScores.length===3));
  assert.ok(first.results.every(result=>result.sampleSd>=0));
  assert.ok(first.selectedIndex!==null);
});

test('F15 changing outer validation/test raw and targets cannot change inner search results',async()=>{
  const opts={algorithm:'cart',folds:3,seed:33,metric:'accuracy',configs:[{maxDepth:4,minLeaf:3}]};
  const one=await runModelSearch(triReady.plan,triReady.matrix,opts);
  const outer=new Set([...triReady.matrix.membership.validation,...triReady.matrix.membership.test]);
  const modifiedPlan={...triReady.plan,raw:triReady.plan.raw.map(row=>outer.has(row.id)
    ?{...row,x:999,y:-999,z:999,target:'broken-held-out-label'}:row)};
  const modifiedMatrix={...triReady.matrix,rows:triReady.matrix.rows.map(row=>outer.has(row.id)
    ?{...row,values:[999,-999,999],target:'broken-held-out-label'}:row)};
  const two=await runModelSearch(modifiedPlan,modifiedMatrix,opts);
  assert.deepEqual(one,two);
});

test('F15 regression CV never stratifies continuous targets and reports fold variation',async()=>{
  const result=await runModelSearch(regReady.plan,regReady.matrix,{
    algorithm:'ridge',folds:5,metric:'rmse',configs:[{lambda:0.001},{lambda:0.1}],
  });
  assert.equal(result.status,'complete');
  assert.equal(result.metric,'rmse');
  assert.equal(result.results[0].foldScores.length,5);
  assert.ok(result.results[0].mean<1);
});

test('F15 search rejects illegal model/task combinations, metric and fit budgets',async()=>{
  assert.throws(()=>validateSearchRequest('regression','softmax'),/F15_INVALID_SEARCH_REQUEST/);
  assert.throws(()=>validateSearchRequest('regression','ridge',{metric:'accuracy'}),/F15_INVALID_SEARCH_METRIC/);
  assert.throws(()=>validateSearchRequest('regression','ridge',{configs:Array.from({length:13},()=>({}))}),/F15_SEARCH_BUDGET/);
  await assert.rejects(runModelSearch(triReady.plan,triReady.matrix,{
    algorithm:'cart',folds:3,configs:[{maxDepth:3,minLeaf:2}],
  },()=>{},{aborted:true}),/F15_SEARCH_CANCELLED/);
  assert.throws(()=>fitWorkbenchModel(regReady.matrix,'forest',{trees:31}),/F15_FOREST_TREE_LIMIT/);
  assert.throws(()=>fitWorkbenchModel(triReady.matrix,'softmax',{epochs:0}),/F15_SOFTMAX_PARAMETER_RANGE/);
});

test('F15 selection evidence integrates with existing F14 receipts without exporting fold row IDs',async()=>{
  const selection=await runModelSearch(triReady.plan,triReady.matrix,{
    algorithm:'softmax',folds:3,metric:'accuracy',configs:[{lambda:0.01,epochs:90}],
  });
  const config=selection.results[selection.selectedIndex];
  const candidate={
    id:'f15-experiment-1',algorithm:'softmax',options:config.configuration,
    model:fitWorkbenchModel(triReady.matrix,'softmax',config.configuration),
    selectionEvidence:validateSelectionEvidence({
      kind:'neuroforge-f15-selection',schemaVersion:1,
      scope:selection.scope,algorithm:'softmax',task:selection.task,
      metric:selection.metric,direction:selection.direction,folds:selection.folds,
      seed:selection.seed,foldMembershipDigest:selection.foldMembershipDigest,
      sourceTrainingCount:selection.sourceTrainingCount,
      selectedIndex:selection.selectedIndex,selectedMean:config.mean,selectedSampleSd:config.sampleSd,
      trials:selection.results.map(item=>({
        configIndex:item.configIndex,configuration:item.configuration,
        status:item.status,foldScores:item.foldScores,foldCounts:item.foldCounts,
        mean:item.mean,sampleSd:item.sampleSd,reason:item.reason,
      })),
    },'softmax',selection.task),
  };
  const receipt=await createRunReceipt({matrix:triReady.matrix,plan:triReady.plan,
    candidate,title:'F15 softmax selection'});
  assert.equal(receipt.model.storageMode,'receipt_only');
  assert.equal(receipt.selectionEvidence.selectedIndex,0);
  assert.equal(receipt.selectionEvidence.trials[0].foldScores.length,3);
  assert.ok(!JSON.stringify(receipt).includes('class-1"'));
  const markdown=createRunResearchReport([receipt]);
  assert.match(markdown,/F15 model-selection evidence/);
  assert.match(markdown,/3 fold inner cross-validation/);
  const another=await createRunReceipt({matrix:triReady.matrix,plan:triReady.plan,candidate:{
    ...candidate,id:'f15-experiment-2',selectionEvidence:null,
  },title:'F15 comparative'});
  assert.equal(compareRunReceipts(receipt,another,'accuracy').status,'comparable');
  assert.throws(()=>validateSelectionEvidence({...receipt.selectionEvidence,foldMembershipDigest:'not-a-sha'},
    'softmax',selection.task),/F15_INVALID_SELECTION_EVIDENCE/);
});
