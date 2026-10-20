import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ownerId } from '../identity.js';
import { canonical, reviseDraft } from '../../shared/domain.mjs';

const Draft = mongoose.models.ExperimentDraft || mongoose.model('ExperimentDraft', new mongoose.Schema({
  id: { type: String, unique: true }, ownerId: { type: String, index: true }, revision: Number, appliedOperations: { type: [mongoose.Schema.Types.Mixed], default: [] }, document: mongoose.Schema.Types.Mixed,
}, { timestamps: true }));

export function createDraftRouter({ allowMemoryFallback }) {
  const router = express.Router();
  const memory = new Map();
  router.migrateOwner = (from, to) => { for (const record of memory.values()) if (record.ownerId === from) record.ownerId=to; };
  router.use((req, res, next) => {
    const caller = ownerId(req);
    if (!caller) return res.status(401).json({ code: 'IDENTITY_REQUIRED', error: 'Identity required.' });
    if (mongoose.connection.readyState !== 1 && !allowMemoryFallback) return res.status(503).json({ code: 'STORAGE_UNAVAILABLE', error: 'Database unavailable.' });
    req.ownerId = caller;
    next();
  });
  router.post('/', async (req, res) => {
    try {
      if (req.body.schemaVersion !== 2 || !req.body.configuration || typeof req.body.configuration !== 'object' || Array.isArray(req.body.configuration)) return res.status(400).json({ code: 'INVALID_DRAFT', error: 'Version 2 configuration required.' });
      canonical(req.body.configuration);
      const document = { schemaVersion: 2, id: randomUUID(), parentRunId: req.body.parentRunId ?? null, configuration: req.body.configuration, revision: 0, dirty: false, sync: 'saved', autosavedAt: null };
      if (mongoose.connection.readyState === 1) await Draft.create({ id: document.id, ownerId: req.ownerId, revision: 0, document });
      else memory.set(document.id, { ownerId: req.ownerId, document });
      res.status(201).json({ data: document, storage: mongoose.connection.readyState === 1 ? 'database' : 'memory' });
    } catch { res.status(400).json({ code: 'INVALID_DRAFT', error: 'Unable to create draft.' }); }
  });
  router.get('/:id', async (req, res) => {
    try {
      const record = mongoose.connection.readyState === 1 ? await Draft.findOne({ id: req.params.id, ownerId: req.ownerId }).lean() : memory.get(req.params.id);
      if (!record || record.ownerId !== req.ownerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Draft not found.' });
      res.json({ data: record.document });
    } catch { res.status(500).json({ code: 'READ_FAILED', error: 'Unable to read draft.' }); }
  });
  router.put('/:id', async (req, res) => {
    try {
      if (req.body.schemaVersion !== 2 || !Number.isInteger(req.body.expectedRevision) || !req.body.changes || typeof req.body.changes !== 'object' || Array.isArray(req.body.changes)) return res.status(400).json({ code: 'INVALID_DRAFT', error: 'Version, expected revision and configuration changes required.' });
      canonical(req.body.changes);
      const database = mongoose.connection.readyState === 1;
      const record = database ? await Draft.findOne({ id: req.params.id, ownerId: req.ownerId }).lean() : memory.get(req.params.id);
      if (!record || record.ownerId !== req.ownerId) return res.status(404).json({ code: 'NOT_FOUND', error: 'Draft not found.' });
      const document = { ...reviseDraft(record.document, req.body.changes, req.body.expectedRevision), dirty: false, sync: 'saved' };
      if (database) {
        const updated = await Draft.findOneAndUpdate({ id: req.params.id, ownerId: req.ownerId, revision: req.body.expectedRevision }, { $set: { revision: document.revision, document } });
        if (!updated) return res.status(409).json({ code: 'REVISION_CONFLICT', error: 'Draft changed during save.' });
      } else memory.set(document.id, { ownerId: req.ownerId, document });
      res.json({ data: document });
    } catch (error) { res.status(error.code === 'REVISION_CONFLICT' ? 409 : 400).json({ code: error.code || 'INVALID_DRAFT', error: error.message }); }
  });
  return router;
}
