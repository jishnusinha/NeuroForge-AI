import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStudioRecipe } from '../client/src/ml/pipelineGraph.js';
import { executeStudioPipeline } from '../client/src/ml/pipelineExecutor.js';
import { createRegressionSplit } from '../client/src/ml/modelWorkbench/splits.js';
import { createFeatureMatrix } from '../client/src/ml/modelWorkbench/featureMatrix.js';
import { MODEL_DEFINITIONS, fitWorkbenchModel, predictWorkbenchModel } from '../client/src/ml/modelWorkbench/models.js';
import { evaluateWorkbenchPredictions } from '../client/src/ml/modelWorkbench/metrics.js';

const regression={
  headers:['x','y','z','target'],
  rows:Array.from({length:60},(_,i)=>({
    id:'reg-'+i,x:(i%17)-8,y:Math.floor(i/5)-6,z:(i%5)-2,
    target:4+2*((i%17)-8)-3*(Math.floor(i/5)-6)+0.5*((i%5)-2),
  })),
};
const binary={
  headers:['x','y','label'],
  rows:Array.from({length:80},(_,i)=>({
    id:'binary-'+i,x:i<40?-2-(i%4)/10:2+(i%4)/10,
    y:(i%7)/4,label:i<40?0:1,
  })),
};
const multi={
  headers:['x','y','label'],
  rows:Array.from({length:90},(_,i)=>{
    const cls=i%3;
    return{id:'multi-'+i,x:(cls===1?6:0)+(i%7)/12,
      y:(cls===2?6:0)+(i%11)/15,
      label:['alpha','beta','gamma'][cls]};
  }),
};
function makeMatrix(dataset,taskType='classification',features=null){
  const recipe=defaultStudioRecipe(dataset);
  recipe.taskType=taskType;
  if(features)recipe.featureColumns=features;
  if(taskType==='regression')recipe.nodes=[];
  const plan=executeStudioPipeline(dataset,recipe);
  return {plan,matrix:createFeatureMatrix(plan)};
}
const score=(matrix,model,split='validation')=>{
  const rows=matrix.rows.filter(row=>row.split===split);
  return evaluateWorkbenchPredictions(matrix,predictWorkbenchModel(model,rows.map(row=>row.values)),split);
};

test('F12 seeded regression split ignores continuous targets, is deterministic and exhaustive',()=>{
  const a=createRegressionSplit(regression.rows,{seed:7}),b=createRegressionSplit(regression.rows,{seed:7});
  assert.deepEqual(a.train.map(r=>r.id),b.train.map(r=>r.id));
  const ids=[...a.train,...a.validation,...a.test].map(r=>r.id);
  assert.equal(ids.length,regression.rows.length);
  assert.equal(new Set(ids).size,regression.rows.length);
  const changed=regression.rows.map(row=>({...row,target:row.target+1e8}));
  const c=createRegressionSplit(changed,{seed:7});
  assert.deepEqual(a.train.map(r=>r.id),c.train.map(r=>r.id));
  assert.throws(()=>createRegressionSplit(regression.rows,{seed:-1}),/F12_REGRESSION_SPLIT_INVALID/);
});

test('F12 prepared matrix uses three ordered features and traceable original row IDs',()=>{
  const {plan,matrix}=makeMatrix(regression,'regression',['x','y','z']);
  assert.equal(matrix.task.type,'regression');
  assert.deepEqual(matrix.features,['x','y','z']);
  assert.equal(matrix.rows.length,60);
  assert.deepEqual(matrix.rows[4].values,[regression.rows[4].x,regression.rows[4].y,regression.rows[4].z]);
  assert.deepEqual(plan.rows.map(r=>r.id),matrix.rows.map(r=>r.id));
  assert.equal(matrix.lineage.pipelineSchemaVersion,1);
  assert.deepEqual(matrix.membership,plan.membership);
});

test('F12 ridge multiple regression beats training-only baseline on linear fixture',()=>{
  const {matrix}=makeMatrix(regression,'regression',['x','y','z']);
  const base=fitWorkbenchModel(matrix,'baseline');
  const ridge=fitWorkbenchModel(matrix,'ridge',{lambda:0.000001});
  const baseMetrics=score(matrix,base).metrics;
  const ridgeMetrics=score(matrix,ridge).metrics;
  assert.ok(ridgeMetrics.rmse<0.01,'ridge should recover linear pattern');
  assert.ok(ridgeMetrics.rmse<baseMetrics.rmse);
  assert.ok(ridgeMetrics.r2>0.999);
  assert.deepEqual(predictWorkbenchModel(ridge,matrix.rows.slice(0,2).map(r=>r.values)),
    predictWorkbenchModel(JSON.parse(JSON.stringify(ridge)),matrix.rows.slice(0,2).map(r=>r.values)));
});

test('F12 multiclass preparation preserves all classes and kNN fits three-dimensional-free task',()=>{
  const {matrix}=makeMatrix(multi);
  assert.equal(matrix.task.type,'multiclass_classification');
  assert.deepEqual(matrix.task.classes,['alpha','beta','gamma']);
  const model=fitWorkbenchModel(matrix,'knn',{k:3});
  const report=score(matrix,model);
  assert.ok(report.metrics.accuracy>0.95);
  assert.equal(report.confusion.length,3);
  assert.equal(report.confusion.flat().reduce((a,b)=>a+b,0),report.count);
  assert.equal(report.perClass.reduce((sum,x)=>sum+x.support,0),report.count);
  assert.equal(report.evidence.every(x=>x.probabilities.length===3),true);
});

test('F12 binary logistic generalizes with numerical probabilities',()=>{
  const {matrix}=makeMatrix(binary);
  assert.equal(matrix.task.type,'binary_classification');
  const model=fitWorkbenchModel(matrix,'logistic',{epochs:220,lambda:0.01});
  const report=score(matrix,model);
  assert.ok(report.metrics.accuracy>0.95);
  assert.ok(report.metrics.f1>0.95);
  assert.ok(report.evidence.every(row=>row.probabilities.every(p=>p>=0&&p<=1)));
  const baseline=fitWorkbenchModel(matrix,'baseline');
  assert.ok(score(matrix,baseline).metrics.accuracy<report.metrics.accuracy);
});

test('F12 classification labels do not influence training through held-out targets',()=>{
  const {matrix}=makeMatrix(binary);
  const model=fitWorkbenchModel(matrix,'logistic',{epochs:90,lambda:0.01});
  const changed={...matrix,rows:matrix.rows.map(row=>row.split==='train'?row:
    {...row,target:row.target===0?1:0})};
  const next=fitWorkbenchModel(changed,'logistic',{epochs:90,lambda:0.01});
  assert.deepEqual(model.parameters,next.parameters);
});

test('F12 regression held-out target perturbation never affects split or training coefficients',()=>{
  const {matrix}=makeMatrix(regression,'regression',['x','y','z']);
  const model=fitWorkbenchModel(matrix,'ridge',{lambda:0.001});
  const changed={...matrix,rows:matrix.rows.map(row=>row.split==='train'?row:{...row,target:row.target+10000})};
  assert.deepEqual(model.parameters,fitWorkbenchModel(changed,'ridge',{lambda:0.001}).parameters);
});

test('F12 evaluation reports R² unavailable on a constant test target',()=>{
  const {matrix}=makeMatrix(regression,'regression',['x','y','z']);
  const constant={...matrix,rows:matrix.rows.map(row=>row.split==='validation'?{...row,target:3}:row)};
  const model=fitWorkbenchModel(matrix,'baseline');
  const evidence=score(constant,model);
  assert.equal(evidence.metrics.r2,null);
  assert.equal(evidence.count,matrix.membership.validation.length);
});

test('F12 feature matrix and hyperparameter validation fails closed',()=>{
  const {plan,matrix}=makeMatrix(binary);
  assert.throws(()=>createFeatureMatrix({...plan,outputFeatures:['x','y','missing']}),/F12_NONFINITE_FEATURE/);
  assert.throws(()=>createFeatureMatrix({...plan,membership:{...plan.membership,train:[...plan.membership.train,plan.membership.test[0]]}}),/F12_DUPLICATE_SPLIT_ROW/);
  assert.throws(()=>fitWorkbenchModel(matrix,'ridge'),/F12_UNSUPPORTED_MODEL_TASK/);
  assert.throws(()=>fitWorkbenchModel(matrix,'knn',{k:0}),/F12_K_RANGE/);
  assert.throws(()=>fitWorkbenchModel(matrix,'logistic',{lambda:-1}),/F12_REGULARIZATION_RANGE/);
  const fitted=fitWorkbenchModel(matrix,'baseline');
  assert.throws(()=>predictWorkbenchModel(fitted,[[1,2,3]]),/F12_PREDICTION_SCHEMA_MISMATCH/);
});

test('F12 regression validates finite numeric target and does not invoke class splitter',()=>{
  const bad={...regression,rows:regression.rows.map((row,i)=>i===0?{...row,target:null}:row)};
  const recipe=defaultStudioRecipe(bad);
  recipe.taskType='regression';
  recipe.nodes=[];
  assert.throws(()=>executeStudioPipeline(bad,recipe),/F12_REGRESSION_REQUIRES_FINITE_TARGET/);
});

test('F12 task-aware model registry offers only compatible algorithms',()=>{
  assert.deepEqual(MODEL_DEFINITIONS.filter(item=>item.tasks.includes('regression')).map(item=>item.id),
    ['baseline','ridge']);
  assert.deepEqual(MODEL_DEFINITIONS.filter(item=>item.tasks.includes('multiclass_classification')).map(item=>item.id),
    ['baseline','knn']);
});
