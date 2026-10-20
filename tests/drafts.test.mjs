import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { annotation, modelArtifact, shareLink } from '../shared/contracts.mjs';

test('draft API enforces ownership and revision conflicts without overwriting either configuration', async () => {
  const server = createApp({ allowMemoryFallback: true }).listen(0, '127.0.0.1');
  await new Promise(done => server.once('listening', done));
  const base = `http://127.0.0.1:${server.address().port}/api/v2/drafts`;
  const headers = { 'Content-Type': 'application/json', 'X-Owner-Token': 'draft-test-browser-owner-token' };
  try {
    const created = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ schemaVersion: 2, configuration: { algorithm: 'OLS' } }) });
    assert.equal(created.status, 201);
    const draft = (await created.json()).data;
    assert.equal((await fetch(`${base}/${draft.id}`, { headers: { ...headers, 'X-Owner-Token': 'another-browser-owner-token' } })).status, 404);
    const update = changes => fetch(`${base}/${draft.id}`, { method: 'PUT', headers, body: JSON.stringify({ schemaVersion: 2, expectedRevision: 0, changes }) });
    assert.equal((await update({ algorithm: 'KNN' })).status, 200);
    const conflict = await update({ algorithm: 'Logistic' });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).code, 'REVISION_CONFLICT');
    const saved = (await (await fetch(`${base}/${draft.id}`, { headers })).json()).data;
    assert.equal(saved.configuration.algorithm, 'KNN');
    assert.equal(saved.revision, 1);
  } finally { await new Promise(done => server.close(done)); }
});
test('future artifact, annotation and sharing metadata cannot claim unsupported contracts', () => {
  assert.equal(shareLink({ runId: 'r' }).visibility, 'private');
  assert.throws(() => shareLink({ runId: 'r', scope: 'write' }), { code: 'INVALID_SHARE' });
  assert.throws(() => modelArtifact({ runId: 'r', contentDigest: 'weak' }), { code: 'INVALID_ARTIFACT' });
  assert.equal(annotation({ projectId: 'p', text: 'Observed loss rise', target: { type: 'run', id: 'r' } }).target.id, 'r');
});
