import { validateExplanationContext, F13_LIMITATIONS } from './explainabilityContracts.js';
import { digest } from '../../../../shared/domain.mjs';

/**
 * Summary-only evidence: never expose training examples, neighbor identities,
 * selected validation row IDs, original source values, coefficients or weights.
 */
export async function createExplanationReceipt({
  matrix,model,candidateId,importance=null,local=null,
  dependence=null,whatIf=null,subgroups=null,
}) {
  const validation=validateExplanationContext(matrix,model);
  if(typeof candidateId!=='string'||!candidateId)throw new Error('F13_CANDIDATE_REQUIRED');
  const [modelDigest,pipelineDigest]=await Promise.all([
    digest(model),digest(matrix.lineage.fittedPipeline),
  ]);
  return {
    kind:'neuroforge-f13-explanation-evidence',schemaVersion:1,
    createdAt:new Date().toISOString(),
    engine:'ds-f13.1',
    model:{candidateId,algorithm:model.algorithm,digest:modelDigest},
    pipeline:{schemaVersion:matrix.lineage.pipelineSchemaVersion,digest:pipelineDigest},
    task:matrix.task.type,featureNames:[...matrix.features],
    scope:{name:'validation',availableCount:validation.length,splitSeed:matrix.lineage.splitSeed},
    permutation:importance?{
      status:importance.status,method:importance.method??'repeated-marginal-permutation',
      metric:importance.metric,seed:importance.seed,repeats:importance.repeats,
      sampleCount:importance.sampleCount,baselineScore:importance.baselineScore??null,
      featureScores:importance.features.map(item=>({
        name:item.name,meanImportance:item.meanImportance,standardDeviation:item.standardDeviation,
      })),limitations:importance.limitations??[importance.reason],
    }:null,
    local:local?{
      method:local.method,scale:local.scale??null,
      prediction:local.modelOutput.predicted,
      contributions:(local.contributions??[]).map(item=>({
        feature:item.feature,contribution:item.contribution,
      })),intercept:local.intercept??null,
      reconstruction:local.reconstructed??null,
      // Deliberately omit rowId, preparedValue, neighbors, class-prior vector.
    }:null,
    dependence:dependence?{
      method:dependence.method,feature:dependence.feature,output:dependence.output,
      sampleCount:dependence.sampleCount,points:dependence.points,
      // Deliberately omit row-level ICE curves and IDs.
      limitations:dependence.limitations,
    }:null,
    whatIf:whatIf?{
      method:whatIf.method,modifiedFeatureNames:whatIf.modifiedFeatures,
      originalPrediction:whatIf.originalPrediction,
      hypotheticalPrediction:whatIf.hypotheticalPrediction,
      regressionDelta:whatIf.regressionDelta,
      // Deliberately omit intervention values and any source observation.
      limitations:whatIf.limitations,
    }:null,
    subgroups:subgroups?{
      method:subgroups.method,feature:subgroups.feature,metric:subgroups.metric,
      sampleCount:subgroups.sampleCount,
      groups:subgroups.groups.map(group=>({
        count:group.count,status:group.status,metricValue:group.metricValue,
      })),limitations:subgroups.limitations,
      // Do not include group member IDs or individual row values.
    }:null,
    limitations:[F13_LIMITATIONS.heldout,F13_LIMITATIONS.causal,
      'Explanations characterize a fitted model on observed or hypothetical inputs; they do not guarantee causal interpretation.',
      'Default evidence exports contain aggregate results only, not raw rows or fitted model training data.'],
  };
}
