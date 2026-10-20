import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ownerId as owner } from '../identity.js';
import { Experiment } from '../models/Experiment.js';
import { toDomain, validateDomain, canonical, adaptRecord } from '../../shared/domain.mjs';
const connected = () => mongoose.connection.readyState === 1;
const queryId = id => mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { shareId: id }] } : { shareId: id };
const publicRecord = (doc, storage) => {
  const result = doc.toObject ? doc.toObject() : { ...doc };
  delete result.ownerId;
  return { ...result, storage };
};
export function createExperimentRouter({ allowMemoryFallback = process.env.NODE_ENV !== 'production' } = {}) {
const router = express.Router();
const memory = new Map();
router.migrateOwner = (from, to) => { let count=0; for (const record of memory.values()) if (record.ownerId === from) { record.ownerId=to; count++; } return count; };
router.findResource = async id => connected() ? Experiment.findOne({ $or: [...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []), { runId: id }, { shareId: id }] }).lean() : [...memory.values()].find(run => [run._id, run.runId, run.shareId].includes(id));
router.use((_req, res, next) => {
  if (!connected() && !allowMemoryFallback) return res.status(503).json({ error: 'Database unavailable. No changes were saved.' });
  next();
});
router.get('/', async (req, res) => {
  const ownerId = owner(req);
  if (!ownerId) return res.status(401).json({ error: 'Browser identity required.' });
  try {
    const docs = connected() ? await Experiment.find({ ownerId }).sort({ createdAt: -1 }).limit(100).lean() : [];
    const data = [...docs.map(run => publicRecord(run, 'database')), ...[...memory.values()].filter(run => run.ownerId === ownerId).map(run => publicRecord(run,'memory'))];
    res.json({ success: true, data: await Promise.all(data.map(adaptRecord)) });
  } catch { res.status(500).json({ error: 'Unable to list experiments.' }); }
});
router.get('/:id', async (req, res) => {
  try {
    const dbDoc = connected() ? await Experiment.findOne(queryId(req.params.id)).lean() : null;
    const doc = dbDoc || [...memory.values()].find(run => run.shareId === req.params.id || run._id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Experiment not found.' });
    if (doc.ownerId !== owner(req)) return res.status(404).json({ code: 'NOT_FOUND', error: 'Experiment not found.' });
    const result = publicRecord(doc, dbDoc ? 'database' : 'memory');
    // Adapt in memory; never rewrite a legacy database record on read.
    res.json({ success: true, data: await adaptRecord(result) });
  } catch { res.status(500).json({ error: 'Unable to retrieve experiment.' }); }
});
router.post('/', async (req, res) => {
  const ownerId = owner(req);
  if (!ownerId) return res.status(401).json({ error: 'Browser identity required.' });
  try {
    const { name, description, algorithm, dataset, hyperparameters, metrics, metricHistory, workspace, task, runtime } = req.body;
    if (req.body.schemaVersion !== undefined && req.body.schemaVersion !== 2) return res.status(400).json({ error: 'Unsupported schema version.', code: 'UNSUPPORTED_VERSION' });
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || typeof algorithm !== 'string' || algorithm.length > 200 ||
      typeof dataset?.name !== 'string' || !dataset.name || !Array.isArray(dataset?.points) || dataset.points.length < 2 || dataset.points.length > 2000 ||
      dataset.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.label)) ||
      !['playground', 'studio'].includes(workspace) || !['classification', 'regression', 'clustering'].includes(task) ||
      !metrics || Object.values(metrics).some(v => typeof v === 'number' && !Number.isFinite(v))) {
      return res.status(400).json({ error: 'Invalid run configuration or dataset.' });
    }
    const data = { name, description, algorithm, dataset, hyperparameters, metrics, workspace, task, runtime, modelArtifact: req.body.modelArtifact,
      metricHistory: Array.isArray(metricHistory) ? metricHistory.slice(-1000) : [],
      ownerId, shareId: /^rep-[a-f0-9-]{36}$/.test(req.body.shareId || '') ? req.body.shareId : `rep-${randomUUID()}`, status: 'Completed' };
    if (req.body.domain) {
      if (req.body.runId !== req.body.domain.run?.id) return res.status(400).json({ code: 'INVALID_RUN_ID', error: 'Run identity does not match its snapshot.' });
      await validateDomain(req.body.domain, req.body);
    }
    Object.assign(data, { schemaVersion: 2, runId: req.body.runId || randomUUID(), parentRunId: req.body.parentRunId ?? null, evaluation: req.body.evaluation ?? null });
    data.domain = req.body.domain || await toDomain({ ...data, createdAt: null });
    const existing = connected() ? await Experiment.findOne({ runId: data.runId }).lean() : [...memory.values()].find(run => run.runId === data.runId);
    if (existing) {
      const evidence = domain => canonical({ configuration: domain.run.configuration, dataset: domain.datasetVersion.contentDigest, protocol: domain.evaluationProtocol.contentDigest, metrics: domain.summaryMetrics, series: domain.metricSeries, seeds: domain.run.seeds, runtime: domain.run.runtime, parent: domain.run.parentRunId });
      if (existing.ownerId === ownerId && evidence(existing.domain) === evidence(data.domain)) return res.status(200).json({ success: true, data: publicRecord(existing, connected() ? 'database' : 'memory') });
      return res.status(409).json({ code: 'IMMUTABLE_RUN', error: 'Run identity already exists. Fork a new run to change its evidence.' });
    }
    if (connected()) {
      const saved = await Experiment.create(data);
      return res.status(201).json({ success: true, data: publicRecord(saved, 'database') });
    }
    const record = { ...data, _id: `exp-${randomUUID()}`, createdAt: new Date().toISOString() };
    memory.set(record._id, record);
    res.status(201).json({ success: true, data: publicRecord(record, 'memory') });
  } catch (error) { res.status(error.code === 11000 ? 409 : 400).json({ error: 'Unable to save run. Check its configuration.', code: error.code || 'INVALID_RUN' }); }
});
router.delete('/:id', async (req, res) => {
  const ownerId = owner(req);
  if (!ownerId) return res.status(401).json({ error: 'Browser identity required.' });
  try {
    let deleted;
    if (connected()) deleted = await Experiment.findOneAndDelete({ ...queryId(req.params.id), ownerId });
    if (!deleted) {
      deleted = [...memory.values()].find(run => (run._id === req.params.id || run.shareId === req.params.id) && run.ownerId === ownerId);
      if (deleted) memory.delete(deleted._id);
    }
    if (!deleted) return res.status(404).json({ error: 'Experiment not found or not owned by this browser.' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Unable to delete experiment.' }); }
});
return router;
}
export default createExperimentRouter();
