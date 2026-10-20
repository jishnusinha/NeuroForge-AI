import { validationSample, validateExplanationContext, F13_LIMITATIONS } from './explainabilityContracts.js';
import { predictWorkbenchModel } from './models.js';

const finite = value => typeof value === 'number'&&Number.isFinite(value);

/**
 * Partial dependence and a bounded set of ICE curves. The sweep range comes
 * exclusively from TRAIN feature values. Background rows are VALIDATION.
 */
export function partialDependence(matrix, model, {
  feature, classLabel=null, gridSize=11, maxRows=24, iceRows=6, seed=42,
}={}) {
  validateExplanationContext(matrix,model);
  const column=matrix.features.indexOf(feature);
  if(column<0)throw new Error('F13_PDP_FEATURE_REQUIRED');
  if(!Number.isInteger(gridSize)||gridSize<2||gridSize>20 ||
      !Number.isInteger(iceRows)||iceRows<0||iceRows>12)
    throw new Error('F13_PDP_BUDGET');
  const selectedClass=matrix.task.type==='regression'?null:
    classLabel===null?matrix.task.classes.at(-1):classLabel;
  const classIndex=selectedClass===null?-1:matrix.task.classes.indexOf(selectedClass);
  if(matrix.task.type!=='regression'&&classIndex<0)throw new Error('F13_UNKNOWN_EXPLAINED_CLASS');
  const training=matrix.rows.filter(row=>row.split==='train');
  const trainValues=training.map(row=>row.values[column]).sort((a,b)=>a-b);
  if(!trainValues.length||trainValues.some(value=>!finite(value)))throw new Error('F13_PDP_NO_TRAIN_FEATURE');
  const unique=[...new Set(trainValues)];
  const grid=unique.length<=2?unique:Array.from({length:gridSize},(_,i)=>
    trainValues[0]+(trainValues.at(-1)-trainValues[0])*i/(gridSize-1));
  const background=validationSample(matrix,model,maxRows,seed);
  const curves=background.slice(0,iceRows).map(row=>({rowId:row.id,values:[]}));
  const points=grid.map(value=>{
    const vectors=background.map(row=>row.values.map((item,i)=>i===column?value:item));
    const predictions=predictWorkbenchModel(model,vectors);
    const measured=predictions.map(output=>{
      const result=classIndex<0?output.predicted:output.probabilities[classIndex];
      if(!finite(result))throw new Error('F13_PDP_NONFINITE');
      return result;
    });
    for(let i=0;i<curves.length;i++)curves[i].values.push(measured[i]);
    return {value,meanPrediction:measured.reduce((sum,x)=>sum+x,0)/measured.length};
  });
  return {
    status:'ok',method:'interventional-partial-dependence',scope:'validation',
    feature, output:matrix.task.type==='regression'?'predicted-target':'probability-of-'+String(selectedClass),
    points,curves,trainingRange:[trainValues[0],trainValues.at(-1)],
    sampleCount:background.length,sourceCount:matrix.membership.validation.length,
    limitations:[F13_LIMITATIONS.causal,F13_LIMITATIONS.encoded,
      'Changing one prepared feature independently can create implausible correlated or one-hot combinations.',
      ...(background.length<matrix.membership.validation.length?
        ['Deterministic validation subsample used as background observations.']:[])],
  };
}
