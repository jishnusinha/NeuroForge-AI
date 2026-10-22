import { getSnapshotLocal, listSnapshotsLocal, saveVersionedSnapshotLocal,
  deleteVersionedSnapshotLocal } from './localRepository.js';
import { F14_MAX_RUNS, F14_MAX_RECEIPT_BYTES,
  F14_RUN_PREFIX, validateRunReceipt } from '../ml/modelRegistry/runContracts.js';
import { verifySavedRun } from '../ml/modelRegistry/artifactValidator.js';

const unwrap=record=>{
  if(!record)return null;
  const {ownerScope:unusedOwner,id:storageId,...receipt}=record;
  // Never let an untrusted storage record choose a different user-visible ID.
  if(typeof storageId!=='string' ||
     !storageId.endsWith(':'+F14_RUN_PREFIX+receipt.runId))
    throw new Error('F14_ARCHIVE_ID_MISMATCH');
  void unusedOwner;
  return validateRunReceipt({...receipt,id:F14_RUN_PREFIX+receipt.runId});
};
function notifyArchive(){if(typeof window!=='undefined')window.dispatchEvent(new Event('f14-archive-change'));if(typeof window!=='undefined'&&typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('neuroforge-f14');channel.postMessage('changed');channel.close();}}

export async function saveF14Run(receipt,expectedRevision=0) {
  validateRunReceipt(receipt);
  // Reverify opted-in fitted artifacts before allowing them into the archive.
  await verifySavedRun(receipt);
  if(receipt.revision!==Math.max(1,expectedRevision))
    throw new Error('F14_REVISION_MISMATCH');
  const result=await saveVersionedSnapshotLocal(receipt,expectedRevision,
    {maxItems:F14_MAX_RUNS,maxBytes:F14_MAX_RECEIPT_BYTES+256});
  const saved=validateRunReceipt({...receipt,revision:result.revision,updatedAt:result.updatedAt});notifyArchive();return saved;
}

export async function getF14Run(runId) {
  if(typeof runId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(runId))
    throw new Error('F14_RUN_ID_INVALID');
  return unwrap(await getSnapshotLocal(F14_RUN_PREFIX+runId));
}

export async function listF14Runs() {
  const records=await listSnapshotsLocal(F14_RUN_PREFIX);
  return records.map(unwrap)
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.runId.localeCompare(b.runId));
}

export async function deleteF14Run(runId,expectedRevision) {
  await deleteVersionedSnapshotLocal(F14_RUN_PREFIX+runId,expectedRevision);
  notifyArchive();
  return {success:true,runId};
}
