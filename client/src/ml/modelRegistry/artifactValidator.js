import { digest } from '../../../../shared/domain.mjs';
import { predictWorkbenchModel } from '../modelWorkbench/models.js';
import { validateRunReceipt } from './runContracts.js';

const finite = number => typeof number==='number'&&Number.isFinite(number);
export async function verifySavedRun(receipt) {
  validateRunReceipt(receipt);
  if(receipt.model.storageMode==='receipt_only')
    return {status:'receipt_only',replayable:false,reason:'No fitted model was saved. Recorded evidence remains available.'};
  const artifact=receipt.model.artifact;
  const actual=await digest(artifact);
  if(actual!==receipt.model.digest)throw new Error('F14_MODEL_ARTIFACT_DIGEST_MISMATCH');
  if(JSON.stringify(artifact.features)!==JSON.stringify(receipt.features))
    throw new Error('F14_ARTIFACT_FEATURE_ORDER_MISMATCH');
  if(artifact.algorithm==='knn'||artifact.parameters?.training)
    throw new Error('F14_TRAINING_VECTOR_EXPORT_FORBIDDEN');
  const n=receipt.features.length;
  if(artifact.algorithm==='baseline'){
    if(artifact.task==='regression'&&!finite(artifact.parameters?.mean))
      throw new Error('F14_INVALID_BASELINE_ARTIFACT');
    if(artifact.task!=='regression' && (!Array.isArray(artifact.parameters?.probabilities) ||
      artifact.parameters.probabilities.length!==receipt.task.classes.length ||
      artifact.parameters.probabilities.some(p=>!finite(p)||p<0||p>1)))
      throw new Error('F14_INVALID_BASELINE_ARTIFACT');
  } else {
    const p=artifact.parameters;
    if(!p||!Array.isArray(p.weights)||p.weights.length!==n+1||!p.weights.every(finite) ||
       !Array.isArray(p.standardizer?.mean)||!Array.isArray(p.standardizer?.scale) ||
       p.standardizer.mean.length!==n||p.standardizer.scale.length!==n ||
       !p.standardizer.mean.every(finite) ||
       p.standardizer.scale.some(x=>!finite(x)||x<=0))
      throw new Error('F14_INVALID_LINEAR_ARTIFACT');
  }
  return {status:'verified',replayable:true,model:artifact};
}

export async function replaySavedModel(receipt,preparedInputs) {
  const verification=await verifySavedRun(receipt);
  if(!verification.replayable)throw new Error('F14_RECEIPT_ONLY_NO_INFERENCE');
  if(!Array.isArray(preparedInputs)||preparedInputs.length<1||preparedInputs.length>20 ||
     preparedInputs.some(vector=>!Array.isArray(vector)||vector.length!==receipt.features.length||
       !vector.every(finite)))throw new Error('F14_INVALID_REPLAY_INPUTS');
  return predictWorkbenchModel(verification.model,preparedInputs);
}
