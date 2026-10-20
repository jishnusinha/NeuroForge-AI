import { getPendingOutboxOperations, clearOutboxOperation, updateOutboxStatus, saveSnapshotLocal } from './localRepository.js';
import { request } from './api.js';
let inFlight = null;
let retryAfter = 0;
export function syncOutbox({ force = false } = {}) {
  if (inFlight) return inFlight;
  if (!force && Date.now() < retryAfter) return Promise.resolve(0);
  inFlight = (async () => {
    const scope=localStorage.getItem('neuroforge_account_id') || 'guest';
    const pending = await getPendingOutboxOperations();
    const revisions = new Map();
    let synced = 0;
    for (const operation of pending.filter(op => op.ownerScope === (localStorage.getItem('neuroforge_account_id') || 'guest'))) {
      if(scope!==(localStorage.getItem('neuroforge_account_id') || 'guest'))throw new Error('Identity changed during synchronization.');
      const { draftId, configuration } = operation.payload;
      let wire = operation.wire;
      if (!wire) {
        const chain = draftId + ':' + (operation.payload.clientTabId || 'legacy');
        const expectedRevision = revisions.get(chain) ?? operation.payload.expectedRevision ?? 0;
        wire = { id: operation.id, operation: 'SYNC_DRAFT', payload: { draftId, expectedRevision, configuration } };
        // Persist exact retry content before sending; a lost response cannot create another edit.
        await updateOutboxStatus(operation.id, 'pending', wire);
      }
      const response = await request('/v2/sync', { method: 'POST', body: JSON.stringify({ operations: [wire] }) });
      const result = response.results[0];
      if (!response.durable || result.status !== 'synced') {
        await updateOutboxStatus(operation.id, result.status === 'conflict' ? 'conflict' : 'pending', wire);
        throw new Error(result.error || 'Cloud revision conflict. The local draft was preserved; duplicate it to sync a new draft.');
      }
      revisions.set(draftId + ':' + (operation.payload.clientTabId || 'legacy'), result.revision); await saveSnapshotLocal({ id:'cloud-revision:' + operation.ownerScope + ':' + draftId, revision: result.revision }); await clearOutboxOperation(operation.id); synced++;
    }
    return synced;
  })().catch(error => { retryAfter = Date.now() + 30000; throw error; }).finally(() => { inFlight = null; });
  return inFlight;
}
