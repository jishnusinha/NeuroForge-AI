import { canonical, digest, toDomain } from './domain.mjs';

// Caller supplies raw records, not hydrated models with schema defaults.
export async function prepareBatch(records, batchId) {
  const entries = [];
  for (const raw of records) {
    const original = JSON.parse(JSON.stringify(raw));
    if (original.domain) continue;
    try {
      const domain = await toDomain(original);
      entries.push({ sourceId: String(original._id), original, sourceDigest: await digest(original), domain, domainDigest: await digest(domain) });
    } catch (error) { entries.push({ sourceId: String(original._id), original, error: { code: error.code, message: error.message } }); }
  }
  return { schemaVersion: 2, batchId, createdAt: new Date().toISOString(), counts: { scanned: records.length, skipped: records.length - entries.length, eligible: entries.filter(e => !e.error).length, invalid: entries.filter(e => e.error).length }, entries };
}
export async function applyBatch(batch, repository) {
  const results = [];
  for (const entry of batch.entries) {
    if (entry.error) { results.push({ id: entry.sourceId, status: 'invalid' }); continue; }
    try {
      const current = await repository.read(entry.sourceId);
      if (current?._domainMigration === batch.batchId && canonical(current.domain) === canonical(entry.domain)) { results.push({ id: entry.sourceId, status: 'already-applied' }); continue; }
      if (!current || await digest(current) !== entry.sourceDigest) { results.push({ id: entry.sourceId, status: 'conflict' }); continue; }
      const changed = await repository.attach(entry.sourceId, entry.original, entry.domain, batch.batchId);
      const saved = await repository.read(entry.sourceId);
      results.push({ id: entry.sourceId, status: changed && await digest(saved.domain) === entry.domainDigest ? 'verified' : 'conflict' });
    } catch (error) { results.push({ id: entry.sourceId, status: 'failed', error: error.message }); }
  }
  return results;
}
export async function rollbackBatch(batch, repository) {
  const results = [];
  for (const entry of batch.entries.filter(e => !e.error)) {
    const current = await repository.read(entry.sourceId);
    if (!current?.domain && !current?._domainMigration) { results.push({ id: entry.sourceId, status: 'already-rolled-back' }); continue; }
    if (current?._domainMigration !== batch.batchId || await digest(current.domain) !== entry.domainDigest) { results.push({ id: entry.sourceId, status: 'conflict' }); continue; }
    results.push({ id: entry.sourceId, status: await repository.detach(entry.sourceId, entry.domain, batch.batchId) ? 'rolled-back' : 'conflict' });
  }
  return results;
}
