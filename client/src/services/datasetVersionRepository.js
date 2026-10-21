import { validateWorkingCopy } from '../ml/datasheet/transactions.js';
import { PRODUCTION_CONFIG } from './productionConfig.js';

export const datasetOwner = () => globalThis.localStorage?.getItem('neuroforge_account_id') || 'guest';
const MAX_RECORDS = 8;
function open() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('INDEXEDDB_UNAVAILABLE: Draft was not saved.'));
    const request = indexedDB.open('NeuroForgeDataSheets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sheets', { keyPath: 'key' });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('F17_STORAGE_BLOCKED'));
    request.onsuccess = () => resolve(request.result);
  });
}
export async function listDataSheets(owner = datasetOwner()) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('sheets', 'readonly'), req = tx.objectStore('sheets').getAll();
      tx.oncomplete = () => {
        try {
          const records = req.result.filter(r => r.owner === owner);
          records.forEach(r => validateWorkingCopy(r.source, r.current));
          resolve(records);
        } catch (e) { reject(e); }
      };
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('F17_STORAGE_ABORTED'));
    });
  } finally { db.close(); }
}
export async function saveDataSheet(record, expectedRevision = 0, owner = datasetOwner()) {
  validateWorkingCopy(record.source, record.current);
  if (owner !== datasetOwner()) throw new Error('IDENTITY_CHANGED');
  if (!record.id || !Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('F17_INVALID_RECORD');
  const key = JSON.stringify([owner, record.id]);
  const next = { ...structuredClone(record), owner, key, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
  const limit = PRODUCTION_CONFIG.budgets.storageQuotaSoftLimitBytes;
  const bytes = new TextEncoder().encode(JSON.stringify(next)).length;
  if (globalThis.navigator?.storage?.estimate) {
    const { usage = 0, quota = limit } = await navigator.storage.estimate();
    if (usage + bytes > Math.min(quota, limit)) throw new Error('LOCAL_QUOTA_BUDGET_EXCEEDED');
  }
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('sheets', 'readwrite'), store = tx.objectStore('sheets');
      let failure;
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result, old = records.find(r => r.key === key);
        const total = records.filter(r => r.key !== key).reduce((n, r) => n + new TextEncoder().encode(JSON.stringify(r)).length, 0);
        if (owner !== datasetOwner()) failure = new Error('IDENTITY_CHANGED');
        else if ((old?.revision || 0) !== expectedRevision) failure = new Error('F17_REVISION_CONFLICT: Reload the saved draft before saving again.');
        else if ((!old && records.filter(r => r.owner === owner).length >= MAX_RECORDS) || total + bytes > limit)
          failure = new Error('LOCAL_QUOTA_BUDGET_EXCEEDED: Export or delete an older DataSheet.');
        if (failure) tx.abort(); else store.put(next);
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(failure || tx.error);
      tx.onabort = () => reject(failure || tx.error || new Error('F17_STORAGE_ABORTED'));
    });
  } finally { db.close(); }
}
export async function deleteDataSheet(id, owner = datasetOwner()) {
  if (owner !== datasetOwner()) throw new Error('IDENTITY_CHANGED');
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sheets', 'readwrite');
      tx.objectStore('sheets').delete(JSON.stringify([owner, id]));
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
