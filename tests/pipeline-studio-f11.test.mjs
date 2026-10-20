import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStudioRecipe, validateStudioRecipe, createStudioNode } from '../client/src/ml/pipelineGraph.js';
import { executeStudioPipeline, transformStudioArtifact } from '../client/src/ml/pipelineExecutor.js';
import { buildDatasetPipeline } from '../client/src/ml/pipelinePlanner.js';

const numeric={
  headers:['feature_x','feature_y','label','segment'],
  rows:Array.from({length:40},(_,index)=>({
    id:'row-'+index,
    feature_x: index===0?null:1+index,
    feature_y: index===5?null:(index%13)*2,
    label: index<20?0:1,
    segment:index%2===0?'Alpha':'Beta',
  })),
};

test('F11 default recipe compiles to real transformations with stable split membership',()=>{
  const recipe=defaultStudioRecipe(numeric);
  const first=executeStudioPipeline(numeric,recipe);
  const second=executeStudioPipeline(numeric,recipe);
  assert.deepEqual(recipe.featureColumns,['feature_x','feature_y']);
  assert.equal(recipe.targetColumn,'label');
  assert.deepEqual(first.membership,second.membership);
  assert.deepEqual(first.rows,second.rows);
  assert.equal(first.rows.length,40);
  assert.equal(first.outputFeatures.length,2);
  assert.equal(first.labCompatible,true);
  assert.ok(first.rows.every(row=>Number.isFinite(row.feature_x)&&Number.isFinite(row.feature_y)));
  assert.deepEqual(first.rows,transformStudioArtifact(first.artifact,numeric.rows));
  assert.deepEqual(numeric.rows[0].feature_x,null);
  assert.equal(first.stageEvidence.length,2);
});

test('F11 default order and execution match the existing F3 train-only pipeline',()=>{
  const data={headers:numeric.headers,rows:numeric.rows};
  const f3=buildDatasetPipeline(data,{columns:{x:'feature_x',y:'feature_y',target:'label'},
    imputation:'mean',scaling:'standardize',splitPreset:'70/15/15',seed:42});
  const f11=executeStudioPipeline(data,defaultStudioRecipe(data));
  assert.deepEqual(f11.membership,f3.membership);
  const legacy=new Map(f3.points.map(row=>[row.id,row]));
  for(const row of f11.labPoints){
    const previous=legacy.get(row.id);
    assert.ok(Math.abs(row.x-previous.x)<1e-10);
    assert.ok(Math.abs(row.y-previous.y)<1e-10);
    assert.equal(row.label,previous.label);
  }
});

test('F11 training-fitted parameters never include changed validation and test observations',()=>{
  const original=executeStudioPipeline(numeric,defaultStudioRecipe(numeric));
  const heldOut=new Set([...original.membership.validation,...original.membership.test]);
  const changed={...numeric,rows:numeric.rows.map(row=>heldOut.has(row.id)?
    {...row,feature_x:999999,feature_y:-999999}:row)};
  const next=executeStudioPipeline(changed,defaultStudioRecipe(changed));
  assert.deepEqual(original.membership,next.membership);
  assert.deepEqual(original.artifact.fittedNodes,next.artifact.fittedNodes);
  assert.notDeepEqual(original.rows,next.rows);
});

test('F11 order and missing imputation fail closed; disabled steps are not executed',()=>{
  const recipe=defaultStudioRecipe(numeric);
  recipe.nodes.reverse();
  assert.throws(()=>executeStudioPipeline(numeric,recipe),/F11_NONFINITE_(TRAIN|FEATURE)/);
  recipe.nodes[0].enabled=false;
  assert.equal(executeStudioPipeline(numeric,recipe).rows.length,40);
  recipe.nodes[1].enabled=false;
  assert.throws(()=>executeStudioPipeline(numeric,recipe),/F11_UNENCODED_OR_MISSING/);
});

test('F11 supports train-fitted mode imputation and deterministic one-hot categories',()=>{
  const recipe=defaultStudioRecipe(numeric);
  recipe.featureColumns=['segment'];
  recipe.nodes=[
    {id:'cat-impute',type:'category.impute',columns:['segment'],enabled:true,options:{strategy:'mode'}},
    {id:'cat-encode',type:'category.onehot',columns:['segment'],enabled:true,options:{unknown:'allZero'}},
  ];
  const result=executeStudioPipeline(numeric,recipe);
  assert.equal(result.outputFeatures.length,2);
  assert.equal(result.labCompatible,false);
  assert.match(result.reason,/original numeric input/);
  const fitted=result.artifact.fittedNodes[1].parameters.segment;
  assert.deepEqual(fitted.categories,['Alpha','Beta']);
  const unseen=transformStudioArtifact(result.artifact,[{id:'new',segment:'Gamma'}]);
  assert.deepEqual(result.outputFeatures.map(name=>unseen[0][name]),[0,0]);
  assert.deepEqual(result.rows,transformStudioArtifact(JSON.parse(JSON.stringify(result.artifact)),numeric.rows));
  const strict={...recipe,nodes:recipe.nodes.map(node=>node.type==='category.onehot'?
    {...node,options:{unknown:'error'}}:node)};
  const strictArtifact=executeStudioPipeline(numeric,strict).artifact;
  assert.throws(()=>transformStudioArtifact(strictArtifact,[{segment:'Gamma'}]),/F11_UNKNOWN_CATEGORY/);
});

test('F11 generic matrix can be prepared without falsely claiming old labs support extra features',()=>{
  const recipe=defaultStudioRecipe(numeric);
  recipe.featureColumns.push('segment');
  recipe.nodes.push({id:'encode',type:'category.onehot',columns:['segment'],enabled:true,options:{unknown:'allZero'}});
  const result=executeStudioPipeline(numeric,recipe);
  assert.equal(result.outputFeatures.length,4);
  assert.equal(result.labCompatible,false);
  assert.match(result.reason,/exactly two/);
  assert.equal(result.labPoints,null);
});

test('F11 robust scaler, squared features and multiplication produce replayable finite values',()=>{
  const recipe=defaultStudioRecipe(numeric);
  recipe.nodes[1].options.strategy='robust';
  recipe.nodes.push({id:'square',type:'feature.square',columns:['feature_x'],enabled:true,options:{}});
  recipe.nodes.push({id:'interaction',type:'feature.interaction',columns:['feature_x','feature_y'],enabled:true,options:{}});
  const result=executeStudioPipeline(numeric,recipe);
  assert.deepEqual(result.outputFeatures,['feature_x','feature_y','feature_x__squared','feature_x__times__feature_y']);
  assert.equal(result.labCompatible,false);
  assert.deepEqual(transformStudioArtifact(result.artifact,numeric.rows),result.rows);
  assert.ok(result.artifact.fittedNodes[1].parameters.feature_x.q1 !== undefined);
});

test('F11 validations reject malformed graph, conflicting roles and unsupported steps',()=>{
  const recipe=defaultStudioRecipe(numeric);
  assert.throws(()=>validateStudioRecipe(numeric,{...recipe,nodes:[...recipe.nodes,recipe.nodes[0]]}),/F11_NODE_ID/);
  assert.throws(()=>validateStudioRecipe(numeric,{...recipe,featureColumns:['label']}),/F11_FEATURE_SCHEMA/);
  assert.throws(()=>validateStudioRecipe(numeric,{...recipe,nodes:[{id:'bad',type:'code.eval',columns:['feature_x'],enabled:true}]}),/F11_NODE_CONFIG/);
  assert.throws(()=>validateStudioRecipe(numeric,{...recipe,nodes:[{id:'bad',type:'category.onehot',columns:['feature_x'],enabled:true,options:{unknown:'allZero'}}]}),/F11_STEP_ORDER/);
  assert.throws(()=>validateStudioRecipe(numeric,{...recipe,nodes:[{id:'bad',type:'feature.interaction',columns:['feature_x'],enabled:true,options:{}}]}),/F11_INTERACTION_COLUMNS/);
  assert.throws(()=>validateStudioRecipe(numeric,{...recipe,seed:-1}),/F11_SPLIT_CONFIG/);
  assert.equal(createStudioNode('category.onehot',{...recipe,featureColumns:['segment'],nodes:[]},numeric).columns[0],'segment');
});

test('F11 invalid one-hot cardinality and withheld-category policies are explicit',()=>{
  const many={...numeric,rows:numeric.rows.map((row,index)=>({...row,segment:'group-'+index%12}))};
  const recipe=defaultStudioRecipe(many);
  recipe.featureColumns=['segment'];
  recipe.nodes=[{id:'encode',type:'category.onehot',columns:['segment'],enabled:true,options:{unknown:'allZero'}}];
  assert.throws(()=>executeStudioPipeline(many,recipe),/F11_CATEGORY_LIMIT/);
});
