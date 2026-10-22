/**
 * Compare strictly on observed validation metrics, not final-test scores.
 * Different feature pipelines MAY be compared if their evaluation population
 * and target semantics are identical.
 */
import { validateRunReceipt } from './runContracts.js';
export const REGISTRY_METRICS = Object.freeze({
  accuracy:{direction:'maximize',tasks:['binary_classification','multiclass_classification']},
  macroF1:{direction:'maximize',tasks:['binary_classification','multiclass_classification']},
  weightedF1:{direction:'maximize',tasks:['binary_classification','multiclass_classification']},
  precision:{direction:'maximize',tasks:['binary_classification']},
  recall:{direction:'maximize',tasks:['binary_classification']},
  f1:{direction:'maximize',tasks:['binary_classification']},
  rmse:{direction:'minimize',tasks:['regression']},
  mae:{direction:'minimize',tasks:['regression']},
  r2:{direction:'maximize',tasks:['regression']},
});

export function compareRunReceipts(a,b,metric) {
  validateRunReceipt(a);validateRunReceipt(b);
  const definition=REGISTRY_METRICS[metric];
  if(!definition)throw new Error('F14_UNKNOWN_COMPARISON_METRIC');
  const reasons=[];
  if(a.task.type!==b.task.type)reasons.push('Different learning tasks.');
  if(a.task.targetColumn!==b.task.targetColumn ||
     JSON.stringify(a.task.classes)!==JSON.stringify(b.task.classes))
    reasons.push('Different target or class definitions.');
  if(a.lineage.sourceDigest!==b.lineage.sourceDigest)reasons.push('Different source datasets.');
  if(a.lineage.splitDigest!==b.lineage.splitDigest)reasons.push('Different train/validation/test membership.');
  if(a.validation.metricDefinitionVersion!==b.validation.metricDefinitionVersion)
    reasons.push('Metric definition versions differ.');
  if(!definition.tasks.includes(a.task.type)||!definition.tasks.includes(b.task.type))
    reasons.push('Selected metric does not apply to both tasks.');
  const left=a.validation.metrics[metric],right=b.validation.metrics[metric];
  const measured=Number.isFinite(left)&&Number.isFinite(right);
  if(!measured)reasons.push('One or both runs have no defined measurement for this metric.');
  const comparable=reasons.length===0;
  return {
    status:comparable?'comparable':measured?'contextual':'unavailable',
    metric,direction:definition.direction,reasons,
    left:{id:a.runId,algorithm:a.model.algorithm,score:measured?left:null},
    right:{id:b.runId,algorithm:b.model.algorithm,score:measured?right:null},
    betterRunId:comparable?(left===right?null:
      definition.direction==='maximize'?(left>right?a.runId:b.runId):(left<right?a.runId:b.runId)):null,
    notes:[
      'Scores are recorded validation measures, never final-test tuning metrics.',
      ...(a.lineage.pipelineDigest!==b.lineage.pipelineDigest?
        ['Preprocessing pipelines differ; both are evaluated on the same recorded validation population when comparable.']:[]),
      ...(a.lineage.featureSchemaDigest!==b.lineage.featureSchemaDigest?
        ['Model input feature schemas differ; no projection or assumed equivalence is applied.']:[]),
    ],
  };
}

/** Collection ranking is allowed only when every pair shares the F14 contract. */
export function compareRunCollection(runs,metric){
  const definition=REGISTRY_METRICS[metric];
  if(!definition)throw new Error('F20_UNKNOWN_METRIC');
  if(!Array.isArray(runs)||runs.length<2||runs.length>10)throw new Error('F20_COMPARISON_LIMIT');
  const reasons=[],notes=[];let invalid=false;
  for(const run of runs){try{validateRunReceipt(run);}catch{invalid=true;}}
  if(new Set(runs.map(r=>r?.runId)).size!==runs.length)invalid=true;
  if(invalid)return {status:'unavailable',metric,direction:definition.direction,reasons:['A receipt is invalid or a run was selected more than once.'],notes:[],rankings:[],leaders:[]};
  let unavailable=false;
  for(let i=0;i<runs.length;i++)for(let j=i+1;j<runs.length;j++){
    const pair=compareRunReceipts(runs[i],runs[j],metric);
    reasons.push(...pair.reasons);notes.push(...pair.notes);
    unavailable ||= pair.status==='unavailable';
    if(runs[i].validation.count!==runs[j].validation.count)reasons.push('Recorded validation counts differ.');
  }
  const status=unavailable?'unavailable':reasons.length?'contextual':'comparable';
  const sorted=status==='comparable'?[...runs].sort((a,b)=>{
    const delta=a.validation.metrics[metric]-b.validation.metrics[metric];
    return (definition.direction==='minimize'?delta:-delta)||a.runId.localeCompare(b.runId);
  }):[];
  const rankings=sorted.map((r,i)=>({runId:r.runId,score:r.validation.metrics[metric],rank:sorted.findIndex(s=>s.validation.metrics[metric]===r.validation.metrics[metric])+1,index:i}));
  return {status,metric,direction:definition.direction,reasons:[...new Set(reasons)],notes:[...new Set(notes)],rankings,leaders:rankings.filter(r=>r.rank===1).map(r=>r.runId)};
}
