import { executeStudioPipeline } from '../pipelineExecutor.js';
/**
 * Create a fold-aware prepared matrix by re-running every F11 stage with a
 * restricted RAW original-training subset. No held-out outer observations
 * are present in this function's input population.
 */
export function prepareInnerFold(plan,outerMatrix,fold) {
  if(!plan?.recipe||!Array.isArray(plan.raw)||!outerMatrix?.membership ||
     !fold||!Array.isArray(fold.train)||!Array.isArray(fold.validation))
    throw new Error('F15_INNER_PIPELINE_REQUIRED');
  const originalTraining=new Set(outerMatrix.membership.train);
  const included=[...fold.train,...fold.validation];
  if(included.some(id=>!originalTraining.has(id)) ||
     new Set(included).size!==originalTraining.size ||
     included.length!==originalTraining.size)
    throw new Error('F15_OUTER_HOLDOUT_LEAK');
  const raw=plan.raw.filter(row=>originalTraining.has(row.id));
  if(raw.length!==included.length)throw new Error('F15_RAW_TRAIN_ID_MISMATCH');
  const target=plan.recipe.targetColumn;
  const headers=Object.keys(raw[0]).filter(name=>name!=='id');
  const subset={headers,rows:raw.map(row=>({...row}))};
  const foldPlan=executeStudioPipeline(subset,plan.recipe,{membershipOverride:{
    train:[...fold.train],validation:[...fold.validation],test:[],
  }});
  const membership=new Map([
    ...fold.train.map(id=>[id,'train']),...fold.validation.map(id=>[id,'validation']),
  ]);
  const rows=foldPlan.rows.map(row=>({
    id:row.id,values:foldPlan.outputFeatures.map(name=>row[name]),
    target:row[target],split:membership.get(row.id),
  }));
  if(rows.some(row=>!row.split || row.values.some(x=>!Number.isFinite(x))))
    throw new Error('F15_FOLD_PREPARED_SCHEMA');
  // Train-derived class ordering is fixed to the outer experiment vocabulary.
  const classes=outerMatrix.task.classes;
  if(outerMatrix.task.type!=='regression' &&
     (classes.some(value=>!rows.filter(row=>row.split==='train').some(row=>row.target===value)) ||
      rows.some(row=>!classes.includes(row.target))))
    throw new Error('F15_FOLD_UNSEEN_CLASS');
  return {schemaVersion:1,task:structuredClone(outerMatrix.task),
    features:[...foldPlan.outputFeatures],rows,
    membership:{train:[...fold.train],validation:[...fold.validation],test:[]},
    lineage:{foldIndex:fold.index,fittedPipeline:foldPlan.artifact},
  };
}
