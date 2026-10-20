/**
 * Immutable updates with explicit model binding. The local repository owns
 * revision increments and conflict detection; these helpers validate content.
 */
import { validateRunReceipt } from './runContracts.js';
const clone=record=>structuredClone(record);
export function reviseRunMetadata(run,{title,tags,notes}={}) {
  validateRunReceipt(run);
  const next=clone(run);
  if(title!==undefined)next.title=title;
  if(tags!==undefined)next.tags=tags;
  if(notes!==undefined)next.notes=notes;
  next.updatedAt=new Date().toISOString();
  return validateRunReceipt(next);
}
export function attachExplanationToRun(run,receipt) {
  validateRunReceipt(run);
  if(receipt?.kind!=='neuroforge-f13-explanation-evidence' ||
     receipt.schemaVersion!==1 ||
     receipt.model?.digest!==run.model.digest ||
     receipt.pipeline?.digest!==run.lineage.pipelineDigest ||
     receipt.scope?.name!=='validation' ||
     receipt.task!==run.task.type ||
     JSON.stringify(receipt.featureNames)!==JSON.stringify(run.features)) {
    throw new Error('F14_EXPLANATION_PROVENANCE_MISMATCH');
  }
  const next=clone(run);
  if(next.explanations.length>=8)throw new Error('F14_EXPLANATION_LIMIT');
  next.explanations.push(clone(receipt));
  next.updatedAt=new Date().toISOString();
  return validateRunReceipt(next);
}
