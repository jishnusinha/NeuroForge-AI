import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createApp } from '../server/app.js';
import { Experiment } from '../server/models/Experiment.js';
import { startTestMongo, dropTestDatabase } from './support/mongo.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const require = createRequire(new URL('../server/package.json', import.meta.url));
const mongoose = require('mongoose');

test('real MongoDB persistence survives reconnect and enforces report/owner boundaries', { timeout: 45000 }, async () => {
  const mongo = await startTestMongo();
  let server;
  try {
    await mongoose.connect(mongo.uri, { dbName: mongo.dbName, serverSelectionTimeoutMS: 10000 });
    await Experiment.init();
    server = createApp({ allowMemoryFallback: false }).listen(0, '127.0.0.1');
    await new Promise(done => server.once('listening', done));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const headers = { 'Content-Type': 'application/json', 'X-Owner-Token': 'mongo-integration-owner-token' };
    const other = { ...headers, 'X-Owner-Token': 'different-integration-owner-token' };
    assert.equal((await (await fetch(`${base}/ready`)).json()).durable, true);
    const payload = { name: 'Real saved regression', algorithm: 'Linear Regression', workspace: 'playground', task: 'regression',
      dataset: { name: 'Tiny dataset', points: [{id:'a',x:0,y:1,label:0},{id:'b',x:1,y:3,label:0}], seed:42, trainRatio:.5, fingerprint:'abc',splitFingerprint:'def',preprocessing:'none' },
      hyperparameters:{method:'ols'}, metrics:{mse:0,testMse:0}, metricHistory:[] };
    const response = await fetch(`${base}/experiments`, { method:'POST', headers, body:JSON.stringify(payload) });
    assert.equal(response.status,201);
    const saved = (await response.json()).data;
    assert.equal(saved.storage,'database'); assert.equal(saved.ownerId,undefined);
    assert.equal(saved.domain.schemaVersion, 2);
    assert.deepEqual(saved.domain.summaryMetrics, payload.metrics);
    assert.equal(saved.domain.legacyOriginal.ownerId, undefined);
    // Concurrent updates use an atomic revision predicate in the real database.
    const draftResponse = await fetch(`${base}/v2/drafts`, { method: 'POST', headers, body: JSON.stringify({ schemaVersion: 2, configuration: { algorithm: 'OLS' } }) });
    const draft = (await draftResponse.json()).data;
    const edits = await Promise.all(['KNN', 'Logistic'].map(algorithm => fetch(`${base}/v2/drafts/${draft.id}`, { method: 'PUT', headers, body: JSON.stringify({ schemaVersion: 2, expectedRevision: 0, changes: { algorithm } }) })));
    assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
    const syncOperation = { id:'mongo-operation-1', operation:'SYNC_DRAFT', payload:{draftId:draft.id,expectedRevision:1,configuration:{algorithm:'Synced configuration'}} };
    const sync = op => fetch(`${base}/v2/sync`,{method:'POST',headers,body:JSON.stringify({operations:[op]})});
    const result = await (await sync(syncOperation)).json();
    assert.equal(result.results[0].status,'synced');
    assert.equal((await (await sync(syncOperation)).json()).results[0].revision,2);
    assert.equal((await (await sync({...syncOperation,payload:{...syncOperation.payload,configuration:{algorithm:'Tampered retry'}}})).json()).results[0].status,'failed');
    const competing = await Promise.all(['a','b'].map(id=>sync({id:'concurrent-'+id,operation:'SYNC_DRAFT',payload:{draftId:draft.id,expectedRevision:2,configuration:{algorithm:id}}}).then(r=>r.json())));
    assert.deepEqual(competing.map(r=>r.results[0].status).sort(),['conflict','synced']);
    assert.equal((await (await sync({id:'unsupported',operation:'UNSUPPORTED_OPERATION',payload:{}})).json()).results[0].status,'failed');
    assert.equal((await fetch(`${base}/v2/drafts/${draft.id}`, { headers: other })).status, 404);
    // Run the actual explicit migration CLI against one raw legacy record.
    const legacy = { ...payload, status: 'Completed', ownerId: 'legacy-owner', shareId: 'legacy-share', createdAt: new Date() };
    const inserted = await Experiment.collection.insertOne(legacy);
    const migrationUrl = new URL(mongo.uri);
    migrationUrl.pathname = `/${mongo.dbName}`;
    const options = { env: { ...process.env, MONGODB_URI: migrationUrl.toString() }, windowsHide: true, timeout: 20000 };
    await execute(process.execPath, ['scripts/migrate-domain.mjs'], options);
    assert.equal((await Experiment.collection.findOne({ _id: inserted.insertedId })).domain, undefined);
    const applied = await execute(process.execPath, ['scripts/migrate-domain.mjs', '--apply'], options);
    const backupFile = JSON.parse(applied.stdout.match(/"backupFile":\s*("(?:[^"\\]|\\.)*")/)[1]);
    const migrated = await Experiment.collection.findOne({ _id: inserted.insertedId });
    assert.deepEqual(migrated.domain.summaryMetrics, payload.metrics);
    assert.equal(migrated.domain.run.seeds.split, null);
    await execute(process.execPath, ['scripts/migrate-domain.mjs', '--retry', backupFile], options);
    await execute(process.execPath, ['scripts/migrate-domain.mjs', '--rollback', backupFile], options);
    const restored = await Experiment.collection.findOne({ _id: inserted.insertedId });
    assert.equal(restored.domain, undefined);
    assert.deepEqual(restored.metrics, payload.metrics);
    await Experiment.collection.deleteOne({ _id: inserted.insertedId });
    await mongoose.disconnect();
    assert.equal((await fetch(`${base}/ready`)).status,503);
    assert.equal((await fetch(`${base}/experiments`,{method:'POST',headers,body:JSON.stringify(payload)})).status,503);
    await mongoose.connect(mongo.uri, { dbName:mongo.dbName });
    const report = (await (await fetch(`${base}/experiments/${saved.shareId}`, { headers })).json()).data;
    assert.equal(report.name,payload.name); assert.equal(report.metrics.mse,0); assert.equal(report.dataset.points.length,2);
    assert.equal((await (await fetch(`${base}/experiments`,{headers})).json()).data.length,1);
    assert.equal((await (await fetch(`${base}/experiments`,{headers:other})).json()).data.length,0);
    assert.equal((await fetch(`${base}/experiments/${saved._id}`,{method:'DELETE',headers:other})).status,404);
    assert.equal((await fetch(`${base}/experiments/${saved.shareId}`,{method:'DELETE',headers})).status,200);
    assert.equal((await fetch(`${base}/experiments/${saved.shareId}`)).status,404);
  } finally {
    if (server) await new Promise(done => server.close(done));
    if (mongoose.connection.readyState === 1) await dropTestDatabase(mongoose.connection,mongo.dbName);
    await mongoose.disconnect(); await mongo.dispose();
  }
});
