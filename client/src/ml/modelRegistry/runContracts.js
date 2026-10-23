/**
 * DS-F14: a content-addressed *research receipt*, not an implicit model export.
 * This module never embeds source rows, per-row predictions or kNN vectors.
 */
import { digest } from '../../../../shared/domain.mjs';
import { validateExplanationContext } from '../modelWorkbench/explainabilityContracts.js';
import { predictWorkbenchModel } from '../modelWorkbench/models.js';
import { evaluateWorkbenchPredictions } from '../modelWorkbench/metrics.js';
import { validateSelectionEvidence } from '../modelSelection/selectionEvidence.js';

export const F14_SCHEMA_VERSION = 1;
export const F14_RUN_PREFIX = 'f14-run:';
export const F14_MAX_RUNS = 30;
export const F14_MAX_RECEIPT_BYTES = 48 * 1024;
export const F14_METRICS_VERSION = 1;
const isDigest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const plain = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
const validTags = value => Array.isArray(value) && value.length <= 8 &&
  value.every(tag => typeof tag === 'string' && /^[a-zA-Z0-9 _-]{1,25}$/.test(tag)) &&
  new Set(value).size === value.length;
const metricKeys = task => task === 'regression' ? ['mae','mse','rmse','r2'] :
  ['accuracy','macroF1','weightedF1','precision','recall','f1'];
const validMeasurements = (metrics,task) => metrics && typeof metrics === 'object' &&
  metricKeys(task).every(key => !(key in metrics) ||
    metrics[key] === null || finite(metrics[key]));
const entryKey = runId => F14_RUN_PREFIX + runId;
const nowISO = () => new Date().toISOString();

export function validateRunReceipt(receipt) {
  if (!receipt || receipt.schemaVersion !== F14_SCHEMA_VERSION ||
      receipt.kind !== 'neuroforge-f14-run' ||
      typeof receipt.runId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(receipt.runId) ||
      receipt.id !== entryKey(receipt.runId) || !validName(receipt.title) ||
      !validTags(receipt.tags) || typeof receipt.notes !== 'string' || receipt.notes.length > 3000 ||
      !['binary_classification','multiclass_classification','regression'].includes(receipt.task?.type) ||
      !Array.isArray(receipt.task.classes) ||
      !Array.isArray(receipt.features) || receipt.features.length < 1 ||
      receipt.features.length > 20 || new Set(receipt.features).size !== receipt.features.length ||
      receipt.features.some(name => typeof name !== 'string' || !name) ||
      !receipt.lineage || !['sourceDigest','splitDigest','pipelineDigest','featureSchemaDigest']
        .every(key=>isDigest(receipt.lineage[key])) ||
      !receipt.model || typeof receipt.model.algorithm !== 'string' ||
      !isDigest(receipt.model.digest) ||
      !['receipt_only','opt_in_artifact'].includes(receipt.model.storageMode) ||
      !receipt.validation || receipt.validation.metricDefinitionVersion !== F14_METRICS_VERSION ||
      !Number.isInteger(receipt.validation.count) || receipt.validation.count < 1 ||
      !validMeasurements(receipt.validation.metrics,receipt.task.type) ||
      !receipt.counts || !['train','validation','test'].every(key =>
        Number.isInteger(receipt.counts[key]) && receipt.counts[key] > 0) ||
      receipt.counts.validation !== receipt.validation.count ||
      !receipt.finalTest || !Array.isArray(receipt.finalTest.accessHistory) ||
      receipt.finalTest.accessHistory.length > 1 ||
      !Array.isArray(receipt.explanations) || receipt.explanations.length > 8 ||
      !Number.isInteger(receipt.revision) || receipt.revision < 1 ||
      typeof receipt.createdAt !== 'string' || typeof receipt.updatedAt !== 'string') {
    throw new Error('F14_INVALID_RUN_RECEIPT');
  }
  if(receipt.selectionEvidence!==undefined&&receipt.selectionEvidence!==null)
    validateSelectionEvidence(receipt.selectionEvidence,receipt.model.algorithm,receipt.task.type);
  if(receipt.model.config?.execution==='full_source_streaming_v1') {
    const config=receipt.model.config;
    if(!Number.isSafeInteger(config.sourceRows)||config.sourceRows!==receipt.counts.train+receipt.counts.validation+receipt.counts.test||
      !Number.isInteger(config.editedCells)||config.editedCells<0||!Number.isInteger(config.seed)||config.seed<0||config.seed>0xffffffff||
      config.task!==receipt.task.type||config.targetColumn!==receipt.task.targetColumn||JSON.stringify(config.features)!==JSON.stringify(receipt.features)||
      !finite(config.lambda)||config.lambda<.000001||config.lambda>10||!Number.isInteger(config.epochs)||config.epochs<1||config.epochs>400||
      !['70/15/15','80/10/10','60/20/20'].includes(config.splitPreset)||!['baseline','ridge','logistic'].includes(receipt.model.algorithm))
      throw new Error('F14_INVALID_FULL_SOURCE_CONFIGURATION');
  }
  if(receipt.task.type === 'regression' && receipt.task.classes.length !== 0)
    throw new Error('F14_INVALID_CLASS_SCHEMA');
  if(receipt.task.type !== 'regression' &&
     (receipt.task.classes.length < 2 || receipt.task.classes.length > 12))
    throw new Error('F14_INVALID_CLASS_SCHEMA');
  if(receipt.finalTest.accessHistory.some(item =>
       typeof item.accessedAt !== 'string' || item.candidateId !== receipt.model.candidateId ||
       item.count !== receipt.counts.test || !validMeasurements(item.metrics,receipt.task.type)))
    throw new Error('F14_INVALID_TEST_ACCESS');
  if(receipt.explanations.some(item =>
      item?.kind !== 'neuroforge-f13-explanation-evidence' ||
      item?.model?.digest !== receipt.model.digest ||
      item?.pipeline?.digest !== receipt.lineage.pipelineDigest ||
      item?.scope?.name !== 'validation'))
    throw new Error('F14_INVALID_EXPLANATION_PROVENANCE');
  if(receipt.model.storageMode === 'opt_in_artifact') {
    const artifact=receipt.model.artifact;
    if(!artifact || artifact.kind !== 'neuroforge-f12-model' ||
       !['baseline','logistic','ridge'].includes(artifact.algorithm) ||
       artifact.algorithm !== receipt.model.algorithm ||
       JSON.stringify(artifact.features) !== JSON.stringify(receipt.features) ||
       artifact.task !== receipt.task.type ||
       JSON.stringify(artifact.classes) !== JSON.stringify(receipt.task.classes))
      throw new Error('F14_INVALID_REPLAY_ARTIFACT');
  } else if(receipt.model.artifact !== null)
    throw new Error('F14_UNEXPECTED_MODEL_ARTIFACT');
  if(new TextEncoder().encode(JSON.stringify(receipt)).length > F14_MAX_RECEIPT_BYTES)
    throw new Error('F14_RECEIPT_TOO_LARGE');
  return receipt;
}

function stableSourceRows(plan) {
  if(!Array.isArray(plan?.raw) || !plan.raw.length)
    throw new Error('F14_SOURCE_DATA_REQUIRED');
  const columns=Object.keys(plan.raw[0]).filter(name=>name!=='id').sort();
  return {
    columns,
    rows:plan.raw.map(row=>({
      id:row.id,values:columns.map(name=>row[name]??null),
    })).sort((a,b)=>String(a.id).localeCompare(String(b.id))),
  };
}

/**
 * Always recompute validation metrics from the actual model before archiving.
 * This is not an evaluation of the sealed test split.
 */
export async function createRunReceipt({
  matrix,plan,candidate,finalTest=null,title='Saved ML experiment',
  tags=[],notes='',includeArtifact=false,existing=null,
}) {
  validateExplanationContext(matrix,candidate?.model);
  if(!validName(title) || !validTags(tags) || typeof notes !== 'string' || notes.length > 3000)
    throw new Error('F14_RUN_METADATA_INVALID');
  if(!candidate.id || candidate.algorithm !== candidate.model.algorithm)
    throw new Error('F14_CANDIDATE_REQUIRED');
  if(includeArtifact && !['baseline','logistic','ridge'].includes(candidate.algorithm))
    throw new Error('F14_PRIVATE_TRAINING_VECTORS: kNN artifacts cannot be persisted.');
  const validationRows=matrix.rows.filter(row=>row.split==='validation');
  const measured=evaluateWorkbenchPredictions(matrix,
    predictWorkbenchModel(candidate.model,validationRows.map(row=>row.values)),'validation');
  const [sourceDigest,splitDigest,pipelineDigest,featureSchemaDigest,modelDigest]=await Promise.all([
    digest(stableSourceRows(plan)),
    digest({train:[...matrix.membership.train].sort(),validation:[...matrix.membership.validation].sort(),
      test:[...matrix.membership.test].sort()}),
    digest(matrix.lineage.fittedPipeline),
    digest({features:matrix.features,task:matrix.task}),
    digest(candidate.model),
  ]);
  const runId=existing?.runId ?? (
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID() : 'run-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  if(existing) {
    validateRunReceipt(existing);
    if(existing.model.candidateId !== candidate.id || existing.model.digest !== modelDigest)
      throw new Error('F14_SAVED_CANDIDATE_MISMATCH');
  }
  const timestamp=nowISO();
  const accessHistory=existing?.finalTest.accessHistory?.map(plain)??[];
  if(finalTest) {
    if(finalTest.candidateId!==candidate.id || !finalTest.report ||
       finalTest.report.split!=='test' ||
       finalTest.report.count!==matrix.membership.test.length ||
       !validMeasurements(finalTest.report.metrics,matrix.task.type) ||
       typeof finalTest.accessedAt!=='string')
      throw new Error('F14_INVALID_TEST_EVIDENCE');
    if(accessHistory.length && accessHistory[0].accessedAt!==finalTest.accessedAt)
      throw new Error('F14_TEST_ALREADY_RECORDED');
    if(!accessHistory.length)
      accessHistory.push({candidateId:candidate.id,accessedAt:finalTest.accessedAt,
        count:finalTest.report.count,metrics:plain(finalTest.report.metrics)});
  }
  const receipt={
    schemaVersion:F14_SCHEMA_VERSION,kind:'neuroforge-f14-run',
    id:entryKey(runId),runId,title:title.trim(),tags:[...tags],notes,
    revision:existing?.revision??1,createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,
    task:plain(matrix.task),features:[...matrix.features],
    counts:Object.fromEntries(['train','validation','test'].map(part=>[part,matrix.membership[part].length])),
    lineage:{sourceDigest,splitDigest,pipelineDigest,featureSchemaDigest},
    model:{
      candidateId:candidate.id,algorithm:candidate.algorithm,
      config:plain(candidate.options??{}),digest:modelDigest,
      storageMode:includeArtifact?'opt_in_artifact':'receipt_only',
      artifact:includeArtifact?plain(candidate.model):null,
    },
    validation:{metricDefinitionVersion:F14_METRICS_VERSION,
      count:measured.count,metrics:plain(measured.metrics),
      confusion:measured.confusion?plain(measured.confusion):null,
      perClass:measured.perClass?plain(measured.perClass):null},
    finalTest:{accessHistory},explanations:existing?.explanations.map(plain)??[],
    selectionEvidence:validateSelectionEvidence(candidate.selectionEvidence??existing?.selectionEvidence??null,
      candidate.algorithm,matrix.task.type),
    limitations:[
      'Research receipt: source rows, per-row predictions and fitted F11 preprocessing are not stored.',
      'Final test is a local audit safeguard, not a cryptographically enforceable lock.',
      'Replaying an opt-in model artifact requires ordered prepared numeric inputs; it does not refit preprocessing.',
    ],
  };
  return validateRunReceipt(receipt);
}
