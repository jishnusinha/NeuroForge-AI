import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperiment, fetchExperimentById, fetchExperiments, removeExperiment } from '../client/src/services/api.js';
const payload = name => ({ name, status: 'Completed', workspace: 'playground', task: 'regression', algorithm: 'OLS', dataset: { name: 'Real data', points: [{ id: 'a', x: 0, y: 0, label: 0 }, { id: 'b', x: 1, y: 1, label: 0 }] }, metrics: { mse: 0 } });
test('offline records remain visible and server saves keep a single canonical identity', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value)};
  try {
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    const local = await createExperiment(payload('Offline real run'));
    assert.equal(local.storage,'local');
    assert.equal((await fetchExperimentById(local._id)).name,local.name);
    globalThis.fetch = async () => ({ok:true,json:async()=>({data:[]})});
    assert.equal((await fetchExperiments()).length,1);
    let posted;
    globalThis.fetch = async (url,options) => {
      posted = JSON.parse(options.body);
      return {ok:true,json:async()=>({data:{...posted,_id:'server-id',storage:'database'}})};
    };
    const server = await createExperiment(payload('Online real run'));
    assert.equal(server.shareId,posted.shareId);
    globalThis.fetch = async () => ({ok:true,json:async()=>({data:[server]})});
    const runs = await fetchExperiments();
    assert.equal(runs.length,2); assert.equal(runs.filter(r=>r.shareId===server.shareId).length,1);
    globalThis.fetch = async () => ({ok:false,status:403});
    await assert.rejects(removeExperiment(server._id),/403/);
    assert.ok(JSON.parse(data.get('neuroforge_saved_experiments')).some(r=>r._id===server._id));
    await removeExperiment(local._id);
    assert.equal(JSON.parse(data.get('neuroforge_saved_experiments')).length,1);
    globalThis.localStorage.setItem = () => { throw new Error('Storage full'); };
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(createExperiment(payload('Cannot save')),/Storage full/);
  } finally { globalThis.fetch=originalFetch; globalThis.localStorage=originalStorage; }
});
