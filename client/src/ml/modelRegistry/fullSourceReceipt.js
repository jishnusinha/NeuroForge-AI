import {digest} from '../../../../shared/domain.mjs';
import {validateRunReceipt} from './runContracts.js';

/** Receipts consume measured streaming evidence; they do not rebuild an in-memory matrix. */
export async function createFullSourceReceipt(result,{title='Full-source experiment',finalTest=null,includeArtifact=false,existing=null}={}) {
  if(result?.kind!=='neuroforge-full-source-fit'||result.schemaVersion!==1||
    result.model?.trainingCount!==result.counts?.train||result.validation?.count!==result.counts?.validation||
    result.validation.split!=='validation'||result.sourceRows!==Object.values(result.counts).reduce((a,b)=>a+b,0))throw new Error('Invalid full-source fitted evidence.');
  const modelDigest=await digest(result.model);
  if(existing){validateRunReceipt(existing);if(existing.model.candidateId!==result.candidateId||existing.model.digest!==modelDigest||existing.lineage.sourceDigest!==result.sourceDigest)throw new Error('The saved experiment belongs to a different full-source candidate.');}
  const timestamp=new Date().toISOString(),runId=existing?.runId??crypto.randomUUID();
  const accessHistory=structuredClone(existing?.finalTest.accessHistory??[]);
  if(finalTest){
    if(finalTest.candidateId!==result.candidateId||finalTest.report?.split!=='test'||finalTest.report.count!==result.counts.test||typeof finalTest.accessedAt!=='string')throw new Error('Invalid full-source final-test evidence.');
    if(accessHistory.length&&accessHistory[0].accessedAt!==finalTest.accessedAt)throw new Error('Final test access is already recorded.');
    if(!accessHistory.length)accessHistory.push({candidateId:result.candidateId,accessedAt:finalTest.accessedAt,count:finalTest.report.count,metrics:structuredClone(finalTest.report.metrics)});
  }
  const report=result.validation;
  return validateRunReceipt({kind:'neuroforge-f14-run',schemaVersion:1,id:'f14-run:'+runId,runId,
    title,tags:existing?.tags??[],notes:existing?.notes??'',revision:existing?.revision??1,
    createdAt:existing?.createdAt??timestamp,updatedAt:timestamp,task:structuredClone(result.task),features:[...result.features],counts:{...result.counts},
    lineage:{sourceDigest:result.sourceDigest,splitDigest:await digest({sourceDigest:result.sourceDigest,split:result.split}),pipelineDigest:await digest(result.pipeline),featureSchemaDigest:await digest({features:result.features,task:result.task})},
    model:{candidateId:result.candidateId,algorithm:result.model.algorithm,config:{...result.config,execution:'full_source_streaming_v1',sourceRows:result.sourceRows,editedCells:result.editedCells},digest:modelDigest,
      storageMode:includeArtifact?'opt_in_artifact':'receipt_only',artifact:includeArtifact?structuredClone(result.model):null},
    validation:{metricDefinitionVersion:1,count:report.count,metrics:structuredClone(report.metrics),confusion:report.confusion??null,perClass:report.perClass??null},
    sourceExecution:{schemaVersion:1,sourceDigestAlgorithm:'csv-sha256-chain-v1',split:structuredClone(result.split),
      preprocessing:{kind:result.pipeline.kind,schemaVersion:1,missing:result.pipeline.missing,scaling:result.pipeline.scaling}},
    finalTest:{accessHistory},explanations:existing?.explanations??[],selectionEvidence:null,
    limitations:[
      'All source records participate in a fixed split; fitting and preprocessing use training records only.',
      'Numeric inputs use training-mean imputation and training population standardization. Arbitrary F11 recipes are not applied.',
      'Source identity is a SHA-256 chain of fixed 1 MiB raw-byte blocks, combined with parsing options and the frozen edit overlay; it is not the standard file SHA-256.',
      'No source rows, edit values, or per-row predictions are stored in this receipt. Model parameters are saved only with explicit opt-in.',
      'Final test protection is local to this worker investigation; a new investigation can access a new test evaluation.',
      'Inference replay accepts ordered numeric inputs with missing values already replaced by the recorded training means.',
    ],
  });
}
