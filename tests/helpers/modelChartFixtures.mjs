import {defaultStudioRecipe} from '../../client/src/ml/pipelineGraph.js';
import {executeStudioPipeline} from '../../client/src/ml/pipelineExecutor.js';
import {createFeatureMatrix} from '../../client/src/ml/modelWorkbench/featureMatrix.js';
import {fitWorkbenchModel,predictWorkbenchModel} from '../../client/src/ml/modelWorkbench/models.js';
import {evaluateWorkbenchPredictions} from '../../client/src/ml/modelWorkbench/metrics.js';
export function fixture(task='classification',algorithm=task==='regression'?'ridge':'logistic',multi=false){
  const dataset={headers:['x','y','target'],rows:Array.from({length:90},(_,i)=>({id:'private-f19-'+i,x:i/10,y:i%7,target:task==='regression'?2*i/10-(i%7):multi?['a','b','c'][i%3]:i%2}))};
  const recipe=defaultStudioRecipe(dataset);recipe.taskType=task;if(task==='regression')recipe.nodes=[];
  const plan=executeStudioPipeline(dataset,recipe),matrix=createFeatureMatrix(plan),points=[];
  const model=fitWorkbenchModel(matrix,algorithm,{epochs:20,onTrainingTrace:p=>points.push(p)});
  const validation=evaluateWorkbenchPredictions(matrix,predictWorkbenchModel(model,matrix.rows.filter(r=>r.split==='validation').map(r=>r.values)));
  return {plan,matrix,candidate:{id:'f19-fixture-'+algorithm,algorithm,model,validation,trainingTrace:points.length?{points}:null}};
}
export function probabilityFixture(targets=[0,0,1,1],scores=[.1,.4,.35,.8]){
  const {matrix,candidate}=fixture();
  const kept=matrix.rows.filter(r=>r.split!=='validation');
  const validation=targets.map((target,i)=>({id:'recorded-validation-'+i,target,values:[i,0],split:'validation'}));
  matrix.rows=[...kept,...validation];matrix.membership.validation=validation.map(r=>r.id);
  candidate.validation=evaluateWorkbenchPredictions(matrix,scores.map(p=>({predicted:p>.5?1:0,probabilities:[1-p,p]})));
  return {matrix,candidate};
}
export const envelope=(candidate,result)=>({candidateId:candidate.id,model:candidate.model,result});
