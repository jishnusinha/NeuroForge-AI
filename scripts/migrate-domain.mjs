import mongoose from '../server/node_modules/mongoose/index.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { prepareBatch, applyBatch, rollbackBatch } from '../shared/migration.mjs';

const args = process.argv.slice(2);
const rollbackIndex = args.indexOf('--rollback');
const retryIndex = args.indexOf('--retry');
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI explicitly. Migration never selects a database implicitly.');
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  const collection = mongoose.connection.collection('experiments');
  const normalize = value => value ? JSON.parse(JSON.stringify(value)) : null;
  const objectId = id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
  const repository = {
    read: async id => normalize(await collection.findOne({ _id: objectId(id) })),
    attach: async (id, original, domain, batchId) => {
      const filter = { ...original, _id: objectId(id), domain: { $exists: false } };
      // Mongo timestamps are BSON dates; retain their types in the compare-and-set filter.
      for (const field of ['createdAt', 'updatedAt']) if (filter[field]) filter[field] = new Date(filter[field]);
      return (await collection.updateOne(filter, { $set: { domain, _domainMigration: batchId } })).modifiedCount === 1;
    },
    detach: async (id, domain, batchId) => (await collection.updateOne({ _id: objectId(id), domain, _domainMigration: batchId }, { $unset: { domain: '', _domainMigration: '' } })).modifiedCount === 1,
  };
  if (rollbackIndex >= 0 || retryIndex >= 0) {
    const file = args[(rollbackIndex >= 0 ? rollbackIndex : retryIndex) + 1];
    const backup = JSON.parse(await readFile(file, 'utf8'));
    if (backup.database !== mongoose.connection.name || !Array.isArray(backup.batch?.entries)) throw new Error('Backup database or format mismatch.');
    const results = rollbackIndex >= 0 ? await rollbackBatch(backup.batch, repository) : await applyBatch(backup.batch, repository);
    console.log(JSON.stringify({ batchId: backup.batch.batchId, results }, null, 2));
    if (results.some(r => ['conflict', 'failed'].includes(r.status))) process.exitCode = 1;
  } else {
    const records = await collection.find({ domain: { $exists: false } }).sort({ _id: 1 }).limit(100).toArray();
    const batch = await prepareBatch(records, randomUUID());
    console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'dry-run', ...batch.counts }));
    if (args.includes('--apply')) {
      const dir = path.resolve('.artifacts/domain-migrations');
      await mkdir(dir, { recursive: true });
      const backupFile = path.join(dir, `${batch.batchId}.json`);
      // Backup is fully written before the first database mutation. Never overwrite a backup.
      await writeFile(backupFile, JSON.stringify({ database: mongoose.connection.name, batch }, null, 2), { flag: 'wx' });
      const results = await applyBatch(batch, repository);
      console.log(JSON.stringify({ backupFile, results }, null, 2));
      if (results.some(r => ['conflict', 'failed', 'invalid'].includes(r.status))) process.exitCode = 1;
    }
  }
} finally { await mongoose.disconnect(); }
