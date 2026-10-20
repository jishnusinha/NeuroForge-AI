import { validateExplanationContext, F13_LIMITATIONS } from './explainabilityContracts.js';
import { predictWorkbenchModel } from './models.js';
import { transformStudioArtifact } from '../pipelineExecutor.js';

const observed = value => value !== null && value !== undefined && value !== '' &&
  (typeof value !== 'number' || Number.isFinite(value));

/**
 * UI options are measured solely from raw TRAIN observations. All settings
 * are source-space; no manual manipulation of invalid one-hot encodings.
 */
export function sourceFeatureControls(plan, matrix) {
  if(!plan?.artifact || !Array.isArray(plan.raw) || !Array.isArray(plan.recipe?.featureColumns))
    throw new Error('F13_SOURCE_PIPELINE_REQUIRED');
  const trainIds = new Set(matrix.membership.train);
  const train = plan.raw.filter(row=>trainIds.has(row.id));
  if(train.length!==trainIds.size)throw new Error('F13_TRAIN_RAW_MISMATCH');
  return plan.recipe.featureColumns.map(name=>{
    const values=train.map(row=>row[name]).filter(observed);
    const numeric=values.length>0&&values.every(value=>typeof value==='number'&&Number.isFinite(value));
    if(numeric){
      const min=Math.min(...values), max=Math.max(...values);
      return {name,type:'numeric',min,max,editable:Number.isFinite(min)&&min<max,
        reason:min===max?'Training feature is constant.':null};
    }
    const choices=[...new Set(values.map(String))].sort((a,b)=>a.localeCompare(b)).slice(0,20);
    return {name,type:'categorical',choices,editable:choices.length>0,
      reason:choices.length===0?'No observed training categories.':null};
  });
}

/**
 * Hypothetical predictions: replace selected ORIGINAL input cells then call
 * transformStudioArtifact with FROZEN F11 fitted parameters. No refitting,
 * target manipulation, validation/test scoring, or training-row disclosure.
 */
export function sourceWhatIf(matrix, model, plan, rowId, edits) {
  const validation=validateExplanationContext(matrix,model);
  const row=validation.find(item=>item.id===rowId);
  if(!row)throw new Error('F13_VALIDATION_ROW_REQUIRED');
  if(!edits||typeof edits!=='object'||Array.isArray(edits))throw new Error('F13_INVALID_WHAT_IF_EDITS');
  const modifiedKeys=Object.keys(edits);
  if(!modifiedKeys.length||modifiedKeys.length>3)
    throw new Error('F13_WHAT_IF_EDIT_BUDGET');
  const controls=sourceFeatureControls(plan,matrix);
  const map=new Map(controls.map(item=>[item.name,item]));
  for(const key of modifiedKeys){
    const descriptor=map.get(key);
    if(!descriptor||!descriptor.editable)throw new Error('F13_WHAT_IF_INPUT_NOT_EDITABLE');
    const value=edits[key];
    if(descriptor.type==='numeric'&&
        (typeof value!=='number'||!Number.isFinite(value)||value<descriptor.min||value>descriptor.max))
      throw new Error('F13_WHAT_IF_OUTSIDE_TRAIN_RANGE');
    if(descriptor.type==='categorical' &&
       (typeof value!=='string'||!descriptor.choices.includes(value)))
      throw new Error('F13_WHAT_IF_UNKNOWN_TRAIN_CATEGORY');
  }
  const raw=plan.raw.find(item=>item.id===rowId);
  if(!raw)throw new Error('F13_SOURCE_ROW_NOT_FOUND');
  const replay=transformStudioArtifact(plan.artifact,[{...raw,...edits}]);
  const transformed=replay[0];
  const prepared=matrix.features.map(name=>transformed[name]);
  const baseline=predictWorkbenchModel(model,[row.values])[0];
  const hypothetical=predictWorkbenchModel(model,[prepared])[0];
  const isRegression=matrix.task.type==='regression';
  return {
    status:'ok',method:'frozen-source-pipeline-replay',scope:'validation',
    modifiedFeatures:modifiedKeys,
    originalPrediction:baseline.predicted,hypotheticalPrediction:hypothetical.predicted,
    originalProbabilities:baseline.probabilities,hypotheticalProbabilities:hypothetical.probabilities,
    regressionDelta:isRegression?hypothetical.predicted-baseline.predicted:null,
    limitations:[F13_LIMITATIONS.causal,
      'Only edits within observed training ranges or observed training categories are allowed.',
      'Changing source inputs may yield unusual combinations; model outputs are hypothetical, not new observations.'],
  };
}
