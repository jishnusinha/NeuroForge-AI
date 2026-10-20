import express from 'express';
import mongoose from 'mongoose';
import { canonical, digest, reviseDraft } from '../../shared/domain.mjs';
import { ownerId } from '../identity.js';
export function createSyncRouter() {
  const router = express.Router();
  router.post('/', async (req, res) => {
    const caller = ownerId(req);
    if (!caller) return res.status(401).json({ code: 'IDENTITY_REQUIRED', error: 'Identity required.' });
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Cloud sync requires a database. Operations remain pending.' });
    if (!Array.isArray(req.body.operations) || req.body.operations.length > 100) return res.status(400).json({ code: 'INVALID_SYNC_PAYLOAD', error: 'Supply at most 100 operations.' });
    const Draft = mongoose.models.ExperimentDraft;
    const results = [];
    for (const op of req.body.operations) {
      try {
        if (!op || typeof op.id !== 'string' || !op.id || op.id.length > 100 || op.operation !== 'SYNC_DRAFT' || !op.payload || typeof op.payload.draftId !== 'string' || !op.payload.configuration || typeof op.payload.configuration !== 'object' || Array.isArray(op.payload.configuration) || !Number.isInteger(op.payload.expectedRevision)) throw new Error('Unsupported or malformed operation.');
        canonical(op.payload.configuration);
        const { draftId, configuration, expectedRevision } = op.payload;
        let existing = await Draft.findOne({ id: draftId, ownerId: caller }).lean();
        const signature = await digest({ operation: op.operation, payload: op.payload });
        const prior = existing?.appliedOperations?.find(item => item.id === op.id);
        if (prior) {
          if (prior.signature !== signature) throw new Error('Operation ID reused with different content.');
          results.push({ id: op.id, status: 'synced', revision: prior.revision }); continue;
        }
        if (!existing) {
          if (expectedRevision !== 0) { results.push({ id: op.id, status: 'conflict', serverRevision: 0 }); continue; }
          const document = { schemaVersion: 2, id: draftId, configuration, revision: 1, dirty: false, sync: 'saved' };
          try { await Draft.create({ id: draftId, ownerId: caller, revision: 1, document, appliedOperations: [{ id: op.id, signature, revision: 1 }] }); }
          catch (error) { if (error.code === 11000) { results.push({ id: op.id, status: 'conflict' }); continue; } throw error; }
          results.push({ id: op.id, status: 'synced', revision: 1 }); continue;
        }
        if ((existing.appliedOperations?.length ?? 0) >= 10000) throw new Error('Draft operation history limit reached. Duplicate to a new draft.');
        if (existing.revision !== expectedRevision) { results.push({ id: op.id, status: 'conflict', serverRevision: existing.revision }); continue; }
        const document = { ...reviseDraft(existing.document, configuration, expectedRevision), dirty: false, sync: 'saved' };
        const updated = await Draft.findOneAndUpdate({ id: draftId, ownerId: caller, revision: expectedRevision }, { $set: { revision: document.revision, document }, $push: { appliedOperations: { id: op.id, signature, revision: document.revision } } });
        results.push({ id: op.id, status: updated ? 'synced' : 'conflict', ...(updated ? { revision: document.revision } : {}) });
      } catch (error) { results.push({ id: op?.id ?? null, status: 'failed', error: error.message }); }
    }
    res.json({ success: true, durable: true, results });
  });
  return router;
}
