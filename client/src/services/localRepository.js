/**
 * NeuroForge IndexedDB Local Repository (Phase 3)
 * Provides durable local storage for drafts, dataset snapshots, outbox operations, and crash recovery.
 */

import { PRODUCTION_CONFIG } from './productionConfig.js';
const ownerScope = () => typeof localStorage !== 'undefined' ? localStorage.getItem('neuroforge_account_id') || 'guest' : 'guest';
const recoveryKey = () => 'active_session:' + ownerScope();
const DB_NAME = 'NeuroForgeLocalDB';
const DB_VERSION = 1;

class MemoryStore {
  constructor() {
    this.drafts = new Map();
    this.snapshots = new Map();
    this.outbox = new Map();
    this.recovery = new Map();
  }
}

const memoryFallback = new MemoryStore();
let testMemoryEnabled = false;
export function enableMemoryStorageForTests() { if (typeof window !== "undefined") throw new Error("Test adapter is Node-only"); testMemoryEnabled = true; }

function hasIndexedDB() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function createMockRequest(result) {
  const req = { result, error: null };
  queueMicrotask(() => {
    if (typeof req.onsuccess === 'function') {
      req.onsuccess({ target: req });
    }
  });
  return req;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recovery')) {
          db.createObjectStore('recovery', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error || new Error('INDEXEDDB_OPEN_FAILED'));
    } catch (err) {
      reject(err);
    }
  });
}

function executeMemoryTransaction(storeName, _mode, callback, originalError) {
  const storeMap = memoryFallback[storeName];
  if (!storeMap) {
    if (originalError) throw originalError;
    throw new Error(`STORE_NOT_FOUND: ${storeName}`);
  }

  const mockStore = {
    put: (item) => {
      storeMap.set(item.id, structuredClone(item));
      return createMockRequest(item.id);
    },
    get: (key) => {
      return createMockRequest(structuredClone(storeMap.get(key)));
    },
    delete: (key) => {
      storeMap.delete(key);
      return createMockRequest(true);
    },
    getAll: () => {
      return createMockRequest(Array.from(storeMap.values()));
    },
  };

  return Promise.resolve(callback(mockStore));
}

async function executeTransaction(storeName, mode, callback) {
  if (!hasIndexedDB()) {
    if (!testMemoryEnabled) throw new Error('INDEXEDDB_UNAVAILABLE: Changes were not saved.');
    return executeMemoryTransaction(storeName, mode, callback);
  }

  try {
    if (mode === 'readwrite' && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const {usage=0,quota=Infinity}=await navigator.storage.estimate();
      if(usage>=Math.min(quota,PRODUCTION_CONFIG.budgets.storageQuotaSoftLimitBytes))throw new Error('LOCAL_QUOTA_BUDGET_EXCEEDED: Export or remove old local work.');
    }
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], mode);
      const store = tx.objectStore(storeName);

      let actionPromise;
      try {
        actionPromise = Promise.resolve(callback(store));
        actionPromise.catch(() => {});
      } catch (err) {
        return reject(err);
      }

      tx.oncomplete = async () => {
        db.close();
        try {
          const res = await actionPromise;
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };

      tx.onerror = () => {
        const err = tx.error || new Error('TRANSACTION_FAILED');
        db.close();
        reject(err);
      };

      tx.onabort = () => {
        const err = tx.error || new Error('TRANSACTION_ABORTED');
        db.close();
        reject(err);
      };
    });
  } catch (err) {
    if (!err.code) err.code = 'LOCAL_STORAGE_FAILED';
    throw err;
  }
}

// Public API
export async function saveDraftLocal(draft) {
  if (!draft || !draft.id) {
    throw new Error('DRAFT_ID_REQUIRED');
  }

  if(draft.ownerScope && draft.ownerScope!==ownerScope())throw new Error('IDENTITY_CHANGED: Draft save cancelled.');
  const expected = draft.expectedRevision ?? Math.max(0, (draft.revision ?? 1) - 1);
  const record = { ...draft, ownerScope: ownerScope(), revision: expected + 1, updatedAt: new Date().toISOString() };
  delete record.expectedRevision;
  await executeTransaction('drafts', 'readwrite', store => new Promise((resolve, reject) => {
    const req = store.get(record.id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      if (req.result && (req.result.ownerScope || 'guest') !== ownerScope()) { reject(new Error('DRAFT_NOT_OWNED')); return; }
      if ((req.result?.revision ?? 0) !== expected) {
        const error = new Error('REVISION_CONFLICT: Another tab changed this draft. Reload or duplicate it.');
        error.code = 'REVISION_CONFLICT'; reject(error); return;
      }
      const write = store.put(record);
      write.onsuccess = () => resolve(); write.onerror = () => reject(write.error);
    };
  }));
  return { success: true, id: record.id, revision: record.revision, at: record.updatedAt };
}

export async function getDraftLocal(id) {
  if (!id) return null;
  return executeTransaction('drafts', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result && (req.result.ownerScope || 'guest') === ownerScope() ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function listDraftsLocal() {
  return executeTransaction('drafts', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []).filter(record => (record.ownerScope || 'guest') === ownerScope());
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteDraftLocal(id) {
  return executeTransaction('drafts', 'readwrite', (store) => {
    store.delete(id);
  });
}

export async function saveSnapshotLocal(snapshot) {
  if (!snapshot || !snapshot.id) throw new Error('SNAPSHOT_ID_REQUIRED');
  const record = {
    ...snapshot,
    id: ownerScope() + ':' + snapshot.id,
    ownerScope: ownerScope(),
    createdAt: snapshot.createdAt || new Date().toISOString(),
  };

  await executeTransaction('snapshots', 'readwrite', (store) => {
    store.put(record);
  });

  return { success: true, id: record.id };
}

export async function getSnapshotLocal(id) {
  return executeTransaction('snapshots', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(ownerScope() + ':' + id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * Versioned, owner-scoped snapshot primitives for DS-F14. All comparisons and
 * writes happen inside one IndexedDB readwrite transaction (CAS semantics).
 * Existing non-versioned F3/F6/F11 snapshots remain untouched.
 */
export async function listSnapshotsLocal(prefix = '') {
  if(typeof prefix!=='string')throw new Error('SNAPSHOT_PREFIX_INVALID');
  return executeTransaction('snapshots','readonly',store=>new Promise((resolve,reject)=>{
    const req=store.getAll();
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>resolve((req.result??[])
      .filter(item=>item.ownerScope===ownerScope() &&
        item.id.startsWith(ownerScope()+':'+prefix)));
  }));
}

export async function saveVersionedSnapshotLocal(record,expectedRevision=0,{maxItems=30,maxBytes=49152}={}) {
  if(!record || typeof record.id!=='string' || !record.id.startsWith('f14-run:') ||
     record.kind!=='neuroforge-f14-run' ||
     !Number.isInteger(expectedRevision) || expectedRevision<0)
    throw new Error('SNAPSHOT_VERSIONED_INVALID');
  if(record.ownerScope && record.ownerScope!==ownerScope())
    throw new Error('IDENTITY_CHANGED: Archive save cancelled.');
  const owner=ownerScope();
  const item={...record,id:owner+':'+record.id,ownerScope:owner,
    revision:expectedRevision+1,updatedAt:new Date().toISOString()};
  if(new TextEncoder().encode(JSON.stringify(item)).length>maxBytes)
    throw new Error('F14_RECEIPT_TOO_LARGE');
  await executeTransaction('snapshots','readwrite',store=>new Promise((resolve,reject)=>{
    const req=store.getAll();
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      const current=(req.result??[]).find(r=>r.id===item.id);
      if((current?.revision??0)!==expectedRevision) {
        reject(new Error('REVISION_CONFLICT: Reload the archive; this run changed in another tab.'));return;
      }
      const count=(req.result??[]).filter(r=>r.ownerScope===owner && r.kind==='neuroforge-f14-run').length;
      if(!current && count>=maxItems) {
        reject(new Error('F14_ARCHIVE_FULL: Delete an archived run before saving another.'));return;
      }
      const write=store.put(item);
      write.onerror=()=>reject(write.error);
      write.onsuccess=()=>resolve();
    };
  }));
  return {...item,id:record.id,ownerScope:undefined};
}

export async function deleteVersionedSnapshotLocal(id,expectedRevision) {
  if(typeof id!=='string' || !id.startsWith('f14-run:') ||
     !Number.isInteger(expectedRevision) || expectedRevision<1)
    throw new Error('F14_DELETE_REQUIRES_REVISION');
  const key=ownerScope()+':'+id;
  return executeTransaction('snapshots','readwrite',store=>new Promise((resolve,reject)=>{
    const req=store.get(key);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{
      if(!req.result || req.result.ownerScope!==ownerScope()) {
        reject(new Error('F14_RUN_NOT_FOUND'));return;
      }
      if(req.result.revision!==expectedRevision) {
        reject(new Error('REVISION_CONFLICT: Reload the archive before deleting.'));return;
      }
      const deletion=store.delete(key);
      deletion.onerror=()=>reject(deletion.error);
      deletion.onsuccess=()=>resolve(true);
    };
  }));
}

export async function saveRecoverySession(session) {
  const record = {
    ...session,
    id: recoveryKey(),
    ownerScope: ownerScope(),
    lastHeartbeat: new Date().toISOString(),
  };

  await executeTransaction('recovery', 'readwrite', (store) => {
    store.put(record);
  });
  return record;
}

export async function getRecoverySession() {
  return executeTransaction('recovery', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(recoveryKey());
      req.onsuccess = () => {
        if(req.result || ownerScope()!=='guest'){resolve(req.result || null);return;}
        const legacy=store.get('active_session');legacy.onsuccess=()=>resolve(legacy.result || null);legacy.onerror=()=>reject(legacy.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearRecoverySession() {
  return executeTransaction('recovery', 'readwrite', (store) => {
    store.delete(recoveryKey());
    if(ownerScope()==='guest')store.delete('active_session');
  });
}

export async function enqueueOutboxOperation(operation, payload) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : `op-${Date.now()}-${Math.random()}`;

  const opRecord = {
    id,
    operation,
    ownerScope: typeof localStorage !== 'undefined' ? localStorage.getItem('neuroforge_account_id') || 'guest' : 'guest',
    payload,
    status: 'pending', // 'pending' | 'syncing' | 'synced' | 'failed'
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };

  await executeTransaction('outbox', 'readwrite', (store) => {
    store.put(opRecord);
  });

  return opRecord;
}

export async function getPendingOutboxOperations() {
  return executeTransaction('outbox', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const ops = (req.result || []).filter((o) => o.status === 'pending').sort((a,b) => a.createdAt.localeCompare(b.createdAt) || (a.payload?.localRevision ?? 0) - (b.payload?.localRevision ?? 0));
        resolve(ops);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function updateOutboxStatus(id, status, wire) {
  return executeTransaction('outbox', 'readwrite', (store) => {
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.status = status;
        if (wire) item.wire = wire;
        item.updatedAt = new Date().toISOString();
        store.put(item);
      }
    };
  });
}

export async function clearOutboxOperation(id) {
  return executeTransaction('outbox', 'readwrite', (store) => {
    store.delete(id);
  });
}

export async function importGuestLocalWork(accountId) {
  if (!accountId || ownerScope() !== accountId) throw new Error('ACCOUNT_IDENTITY_REQUIRED');
  for (const name of ['drafts','outbox']) await executeTransaction(name,'readwrite',store=>new Promise((resolve,reject)=>{
    const request=store.getAll();request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{for(const record of request.result)if((record.ownerScope||'guest')==='guest')store.put({...record,ownerScope:accountId});resolve();};
  }));
  await executeTransaction('recovery','readwrite',store=>new Promise((resolve,reject)=>{
    const request=store.get('active_session:guest');request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{const guest=request.result;if(!guest){resolve();return;}const current=store.get(recoveryKey());current.onerror=()=>reject(current.error);current.onsuccess=()=>{if(!current.result)store.put({...guest,id:recoveryKey(),ownerScope:accountId});store.delete('active_session:guest');resolve();};};
  }));
}
