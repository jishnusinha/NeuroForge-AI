import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import routes from '../server/routes/experimentRoutes.js';
import { Experiment } from '../server/models/Experiment.js';
import { createApp } from '../server/app.js';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const express = require('express');
const mongoose = require('mongoose');

test('API preserves actual data, keeps run details private, and enforces browser ownership', async () => {
  const app = express(); app.use(express.json()); app.use('/api/experiments', routes);
  const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening',r));
  const base = `http://127.0.0.1:${server.address().port}/api/experiments`;
  const headers = { 'Content-Type':'application/json', 'X-Owner-Token':'browser-owner-token-12345' };
  try {
    const payload = {name:'Actual regression',algorithm:'Linear Regression',workspace:'playground',task:'regression',dataset:{name:'Custom',points:[{id:'a',x:0,y:1,label:0},{id:'b',x:1,y:3,label:0}],fingerprint:'abc',splitFingerprint:'def'},metrics:{mse:0,testMse:0}};
    assert.equal((await fetch(base)).status,401);
    assert.equal((await fetch(base,{method:'POST',headers,body:JSON.stringify({name:'bad'})})).status,400);
    const response = await fetch(base,{method:'POST',headers,body:JSON.stringify(payload)});
    assert.equal(response.status,201);
    const saved = (await response.json()).data;
    assert.equal(saved.metrics.mse,0); assert.equal(saved.ownerId,undefined); assert.equal(saved.storage,'memory');
    const repeated = await fetch(base, { method:'POST', headers, body:JSON.stringify({ ...payload, runId: saved.runId }) });
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).data._id, saved._id);
    const conflicting = await fetch(base, { method:'POST', headers, body:JSON.stringify({ ...payload, runId: saved.runId, metrics: { mse: 99 } }) });
    assert.equal(conflicting.status, 409);
    assert.equal((await conflicting.json()).code, 'IMMUTABLE_RUN');
    assert.equal((await (await fetch(`${base}/${saved.shareId}`, { headers })).json()).data.name,payload.name);
    assert.equal((await (await fetch(base,{headers:{...headers,'X-Owner-Token':'different-browser-token-999'}})).json()).data.length,0);
    assert.equal((await fetch(`${base}/${saved._id}`,{method:'DELETE',headers:{...headers,'X-Owner-Token':'different-browser-token-999'}})).status,404);
    assert.equal((await fetch(`${base}/${saved._id}`,{method:'DELETE',headers})).status,200);
    assert.equal((await fetch(`${base}/${saved.shareId}`)).status,404);
    // Exercise the Mongo branch without depending on a machine-specific database.
    const original = Experiment.findOne;
    mongoose.connection.readyState = 1;
    let observed;
    Experiment.findOne = query => { observed = query; return { lean: async () => ({...saved,ownerId:createHash('sha256').update(headers['X-Owner-Token']).digest('hex')}) }; };
    try {
      assert.equal((await fetch(`${base}/${saved.shareId}`, { headers })).status,200);
      assert.deepEqual(observed,{shareId:saved.shareId});
    } finally { Experiment.findOne = original; mongoose.connection.readyState = 0; }
  } finally { await new Promise(r => server.close(r)); }
});

test('production readiness fails honestly without MongoDB and invalid JSON stays a JSON error', async () => {
  const server=createApp({allowMemoryFallback:false}).listen(0,'127.0.0.1');
  await new Promise(done=>server.once('listening',done));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  try {
    assert.equal((await fetch(`${base}/health`)).status,200);
    const ready=await fetch(`${base}/ready`);
    assert.equal(ready.status,503); assert.equal((await ready.json()).durable,false);
    assert.equal((await fetch(`${base}/experiments`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
    const invalid=await fetch(`${base}/experiments`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid'});
    assert.equal(invalid.status,400); assert.equal((await invalid.json()).error,'Invalid JSON request.');
  } finally { await new Promise(done=>server.close(done)); }
});
