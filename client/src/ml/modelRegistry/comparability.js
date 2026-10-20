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
