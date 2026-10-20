// Versioned domain contracts shared by the browser, API, and migration tooling.
export const VERSION = 2;
export class DomainError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  throw new DomainError('INVALID_VALUE', 'Only finite JSON values are supported.');
}
export async function digest(value) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export function snapshot(value) {
  const copy = JSON.parse(JSON.stringify(value));
  const freeze = item => { if (item && typeof item === 'object') { Object.values(item).forEach(freeze); Object.freeze(item); } return item; };
  return freeze(copy);
}
const edges = {
  queued: ['validating', 'cancelled', 'interrupted'], validating: ['running', 'failed', 'cancelled', 'interrupted'],
  running: ['stopping', 'completed', 'failed', 'interrupted'], stopping: ['cancelled', 'failed', 'interrupted'],
  completed: [], cancelled: [], failed: [], interrupted: [],
};
export function transition(run, next, at = new Date().toISOString()) {
  if (!edges[run.state]?.includes(next)) throw new DomainError('INVALID_TRANSITION', `${run.state} cannot transition to ${next}.`);
  return snapshot({ ...run, state: next, updatedAt: at, ...(edges[next].length === 0 ? { finishedAt: at } : {}) });
}
export function reviseDraft(draft, changes, expectedRevision) {
  if (draft.revision !== expectedRevision) throw new DomainError('REVISION_CONFLICT', `Expected revision ${expectedRevision}; current revision is ${draft.revision}.`);
  return snapshot({ ...draft, configuration: { ...draft.configuration, ...changes }, revision: draft.revision + 1, dirty: true, sync: 'unsaved', updatedAt: new Date().toISOString() });
}
export function forkRun(run, id = globalThis.crypto.randomUUID()) {
  return snapshot({ schemaVersion: VERSION, id, parentRunId: run.id, revision: 0, configuration: run.configuration, dirty: false, sync: 'unsaved', autosavedAt: null });
}
export function validateDataset(dataset) {
  if (!Array.isArray(dataset.rows) || dataset.rows.length < 2 || dataset.rows.length > 2000) throw new DomainError('INVALID_DATASET', 'Dataset must contain 2–2000 rows.');
  const ids = new Set();
  for (const row of dataset.rows) {
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id) || ![row.x, row.y, row.label].every(Number.isFinite)) throw new DomainError('INVALID_DATASET', 'Rows require unique IDs and finite numeric values.');
    ids.add(row.id);
  }
}
export function validateMembership(dataset, membership) {
  if (membership === null) return; // Legacy split membership is explicitly unknown.
  const ids = [...membership.train, ...membership.validation, ...membership.test];
  if (ids.length !== dataset.rows.length || new Set(ids).size !== ids.length || ids.some(id => !dataset.rows.some(row => row.id === id))) throw new DomainError('INVALID_SPLIT', 'Split membership must cover each sample exactly once.');
}
export async function toDomain(record, { legacy = true, membership = null, splitSeed = null, parentRunId = null } = {}) {
  const original = JSON.parse(JSON.stringify(record));
  delete original.domain;
  // Ownership and migration bookkeeping are server-private, never report evidence.
  delete original.ownerId;
  delete original._domainMigration;
  const id = record.runId || record._id || globalThis.crypto.randomUUID();
  const dataset = {
    schemaVersion: VERSION, id: `dataset-${id}`, schema: { features: record.task === 'regression' ? ['x'] : ['x', 'y'], target: record.task === 'regression' ? 'y' : 'label', version: 1 },
    preprocessing: { name: record.dataset?.preprocessing ?? 'unknown', version: 1, fittedPipeline: record.dataset?.preparation?.pipeline ?? null },
    rows: (record.dataset?.points || []).map((p, i) => ({ id: String(p.id ?? `legacy-row-${i}`), x: p.x, y: p.y, label: p.label })),
    provenance: { source: legacy ? 'legacy-record' : 'lab', generationSeed: record.dataset?.seed ?? null },
  };
  validateDataset(dataset);
  dataset.contentDigest = await digest({ schema: dataset.schema, preprocessing: dataset.preprocessing, rows: [...dataset.rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) });
  const protocol = { schemaVersion: VERSION, id: `protocol-${id}`, datasetVersionId: dataset.id, task: record.task ?? 'unknown', membership, splitSeed, preprocessing: dataset.preprocessing, metricDefinitions: 'legacy-lab-v1', provenance: membership ? 'recorded' : 'unknown' };
  validateMembership(dataset, membership);
  protocol.contentDigest = await digest({ ...protocol, id: undefined, datasetVersionId: undefined, membership: membership ? Object.fromEntries(Object.entries(membership).map(([key, ids]) => [key, [...ids].sort()])) : null });
  const configuration = { workspace: record.workspace ?? null, algorithm: record.algorithm ?? null, hyperparameters: record.hyperparameters ?? {}, datasetVersionId: dataset.id, protocolId: protocol.id };
  const run = { schemaVersion: VERSION, id, state: record.status === 'Completed' ? 'completed' : 'interrupted', configuration, parentRunId, seeds: { data: record.dataset?.seed ?? null, split: splitSeed, model: record.hyperparameters?.seed ?? null }, runtime: record.runtime ?? null, createdAt: record.createdAt ?? null, finishedAt: record.completedAt ?? null, provenance: legacy ? 'legacy-import' : 'recorded' };
  const series = [];
  const artifacts = [];
  if (record.modelArtifact) {
    const artifact = record.modelArtifact;
    if (artifact.schemaVersion !== VERSION || await digest({ topology: artifact.topology, weights: artifact.weights }) !== artifact.digest) throw new DomainError('INVALID_ARTIFACT', 'Model artifact checksum does not match.');
    artifacts.push({ schemaVersion: VERSION, id: artifact.id, runId: id, topology: artifact.topology, weights: artifact.weights, contentDigest: artifact.digest, location: { kind: 'inline' }, compatibility: artifact.metadata });
  }
  for (const name of ['loss', 'accuracy', 'valLoss', 'valAccuracy']) {
    const values = (record.metricHistory || []).filter(row => Number.isFinite(row[name])).map(row => ({ step: row.epoch ?? null, value: row[name] }));
    if (values.length) series.push({ schemaVersion: VERSION, id: `${id}-${name}`, runId: id, name, split: name.startsWith('val') ? 'validation' : 'train', unit: name.toLowerCase().includes('accuracy') ? 'ratio' : 'algorithm-specific', stepType: record.workspace === 'studio' ? 'epoch' : 'iteration', aggregation: 'recorded-value', values });
  }
  return snapshot({ schemaVersion: VERSION, project: { schemaVersion: VERSION, id: `project-${id}`, title: record.name ?? 'Imported experiment', researchQuestion: null, owner: 'browser', tags: [], datasetVersionIds: [dataset.id], runIds: [id] }, datasetVersion: dataset, evaluationProtocol: protocol, run, metricSeries: series, summaryMetrics: record.metrics ?? {}, artifacts, annotations: [], shareLinks: [], legacyOriginal: legacy ? original : null });
}
export async function validateDomain(domain, record) {
  if (domain?.schemaVersion !== VERSION) throw new DomainError('UNSUPPORTED_VERSION', 'Unsupported domain schema version.');
  validateDataset(domain.datasetVersion);
  validateMembership(domain.datasetVersion, domain.evaluationProtocol.membership);
  const expected = await toDomain({ ...record, runId: domain.run.id }, { legacy: domain.run.provenance === 'legacy-import', membership: domain.evaluationProtocol.membership, splitSeed: domain.evaluationProtocol.splitSeed, parentRunId: domain.run.parentRunId });
  if (canonical(expected) !== canonical(domain)) throw new DomainError('INVALID_SNAPSHOT', 'Domain snapshot does not match its recorded evidence.');
  return domain;
}
export async function adaptRecord(record) {
  if (!record) return record;
  try {
    if (record.domain) {
      const dataset = record.domain.datasetVersion;
      validateDataset(dataset);
      validateMembership(dataset, record.domain.evaluationProtocol.membership);
      if (record.domain.schemaVersion !== VERSION || !edges[record.domain.run.state]) throw new DomainError('INVALID_SNAPSHOT', 'Stored run schema or execution state is invalid.');
      const expected = await digest({ schema: dataset.schema, preprocessing: dataset.preprocessing, rows: [...dataset.rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) });
      if (expected !== dataset.contentDigest) throw new DomainError('INVALID_SNAPSHOT', 'Stored dataset checksum does not match.');
      return record;
    }
    return { ...record, domain: await toDomain(record) };
  }
  catch (error) { return { ...record, domain: null, compatibilityIssues: [{ code: error.code || 'INVALID_LEGACY_RECORD', message: error.message }] }; }
}
