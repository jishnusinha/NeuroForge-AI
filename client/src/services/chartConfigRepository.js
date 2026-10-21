import {datasetOwner} from './datasetVersionRepository.js';
import {PRODUCTION_CONFIG} from './productionConfig.js';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
function open(){return new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB)return reject(new Error('INDEXEDDB_UNAVAILABLE: Chart configuration was not saved.'));
  const req=indexedDB.open('NeuroForgeCharts',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('configurations',{keyPath:'key'});
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('F18_STORAGE_BLOCKED'));
});}
export async function listChartConfigs(owner=datasetOwner()){
  const db=await open();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('configurations'),req=tx.objectStore('configurations').getAll();
    tx.oncomplete=()=>resolve(req.result.filter(r=>r.owner===owner));tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
export async function saveChartConfig(record,expectedRevision=0,owner=datasetOwner()){
  if(owner!==datasetOwner())throw new Error('IDENTITY_CHANGED');
  if(!record?.id||!record.config||!/^[a-f0-9]{64}$/.test(record.datasetDigest)||!Array.isArray(record.rowIds)||record.rowIds.length>2000||!Number.isInteger(expectedRevision)||expectedRevision<0||bytes(record)>128*1024)throw new Error('F18_INVALID_SAVED_CONFIG');
  const next={...structuredClone(record),key:JSON.stringify([owner,record.id]),owner,revision:expectedRevision+1,updatedAt:new Date().toISOString()};
  if(globalThis.navigator?.storage?.estimate){const {usage=0,quota=Infinity}=await navigator.storage.estimate();if(usage+bytes(next)>Math.min(quota,PRODUCTION_CONFIG.budgets.storageQuotaSoftLimitBytes))throw new Error('LOCAL_QUOTA_BUDGET_EXCEEDED');}
  const db=await open();try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('configurations','readwrite'),store=tx.objectStore('configurations'),req=store.getAll();let failure;
    req.onsuccess=()=>{
      const old=req.result.find(r=>r.key===next.key);
      if(owner!==datasetOwner())failure=new Error('IDENTITY_CHANGED');
      else if((old?.revision||0)!==expectedRevision)failure=new Error('F18_REVISION_CONFLICT');
      else if(!old&&req.result.filter(r=>r.owner===owner).length>=20||req.result.filter(r=>r.key!==next.key).reduce((n,r)=>n+bytes(r),0)+bytes(next)>2*1024*1024)failure=new Error('F18_CHART_LIBRARY_FULL');
      if(failure)tx.abort();else store.put(next);
    };
    tx.oncomplete=()=>resolve(next);tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error);
  });}finally{db.close();}
}
export async function deleteChartConfig(id,owner=datasetOwner()){
  if(owner!==datasetOwner())throw new Error('IDENTITY_CHANGED');
  const db=await open();try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('configurations','readwrite');tx.objectStore('configurations').delete(JSON.stringify([owner,id]));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
}
