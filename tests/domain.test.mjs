import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, digest, toDomain, validateDomain, transition, reviseDraft, forkRun } from '../shared/domain.mjs';
import { prepareBatch, applyBatch, rollbackBatch } from '../shared/migration.mjs';

const legacy = () => ({ _id: 'legacy-1', name: 'Original', status: 'Completed', workspace: 'playground', task: 'classification', algorithm: 'Logistic Regression', dataset: { name: 'Data', points: [{ id: 'a', x: 0, y: 1, label: 0 }, { id: 'b', x: 1, y: 0, label: 1 }] }, metrics: { valAccuracy: 0, trainLoss: 0.123456789 }, metricHistory: [{ epoch: 1, loss: 0.5 }] });
test('canonical SHA-256 covers schema, preprocessing and data, independent of key and sample order', async () => {
  assert.equal(await digest({ b: 2, a: 1 }), await digest({ a: 1, b: 2 }));
  assert.equal((await digest({ a: 1 })).length, 64);
  assert.throws(() => canonical({ n: Infinity }), /finite/);
  const record = legacy();
  const a = await toDomain(record);
  record.dataset.points.reverse();
  assert.equal((await toDomain(record)).datasetVersion.contentDigest, a.datasetVersion.contentDigest);
  record.dataset.preprocessing = 'scale-v1';
  assert.notEqual((await toDomain(record)).datasetVersion.contentDigest, a.datasetVersion.contentDigest);
  record.dataset.points[0].id = record.dataset.points[1].id;
  await assert.rejects(toDomain(record), /unique IDs/);
});
test('legacy adaptation preserves metrics and unknown provenance; fork revisions cannot mutate evidence', async () => {
  const original = legacy();
  const evidence = await toDomain(original);
  assert.deepEqual(evidence.summaryMetrics, original.metrics);
  assert.deepEqual(evidence.legacyOriginal, original);
  assert.deepEqual(evidence.run.seeds, { data: null, split: null, model: null });
  assert.equal(evidence.evaluationProtocol.membership, null);
  assert.deepEqual(evidence.artifacts, []);
  const fork = forkRun(evidence.run, 'fork-1');
  const edited = reviseDraft(fork, { algorithm: 'KNN' }, 0);
  assert.equal(edited.parentRunId, evidence.run.id);
  assert.equal(evidence.run.configuration.algorithm, 'Logistic Regression');
  assert.throws(() => { evidence.summaryMetrics.trainLoss = 99; }, TypeError);
  assert.throws(() => reviseDraft(edited, {}, 0), { code: 'REVISION_CONFLICT' });
  original.metrics.trainLoss = 99;
  assert.equal(evidence.summaryMetrics.trainLoss, 0.123456789);
});
test('split validation rejects missing, duplicated and foreign samples; tampered snapshots fail validation', async () => {
  const record = legacy();
  for (const membership of [{ train: ['a'], validation: [], test: [] }, { train: ['a'], validation: ['a'], test: [] }, { train: ['a'], validation: ['foreign'], test: [] }]) await assert.rejects(toDomain(record, { membership }), { code: 'INVALID_SPLIT' });
  const domain = await toDomain(record, { legacy: false, membership: { train: ['a'], validation: ['b'], test: [] }, splitSeed: 42 });
  await validateDomain(domain, record);
  const tampered = structuredClone(domain);
  tampered.summaryMetrics.trainLoss = 0;
  await assert.rejects(validateDomain(tampered, record), { code: 'INVALID_SNAPSHOT' });
});
test('execution transitions reject terminal rewrites and unsupported pause', () => {
  let run = { id: 'job', state: 'queued' };
  for (const next of ['validating', 'running', 'stopping', 'cancelled']) run = transition(run, next);
  assert.ok(run.finishedAt);
  assert.throws(() => transition(run, 'running'), { code: 'INVALID_TRANSITION' });
  assert.throws(() => transition({ state: 'running' }, 'paused'), { code: 'INVALID_TRANSITION' });
});
test('migration verifies writes, retries idempotently and rolls back only untouched migration output', async () => {
  const source = legacy();
  const before = structuredClone(source);
  const records = new Map([[source._id, source]]);
  const repository = {
    read: async id => structuredClone(records.get(id)),
    attach: async (id, original, domain, batchId) => { if (canonical(records.get(id)) !== canonical(original)) return false; records.set(id, { ...original, domain, _domainMigration: batchId }); return true; },
    detach: async id => { const current = records.get(id); delete current.domain; delete current._domainMigration; return true; },
  };
  const batch = await prepareBatch([source], 'batch-1');
  assert.equal((await applyBatch(batch, repository))[0].status, 'verified');
  assert.equal((await applyBatch(batch, repository))[0].status, 'already-applied');
  assert.deepEqual(records.get(source._id).domain.summaryMetrics, before.metrics);
  assert.equal((await rollbackBatch(batch, repository))[0].status, 'rolled-back');
  assert.deepEqual(records.get(source._id), before);
  records.get(source._id).metrics.trainLoss = 88;
  assert.equal((await applyBatch(batch, repository))[0].status, 'conflict');
});
