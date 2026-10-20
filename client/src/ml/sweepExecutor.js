import { modelRunner } from './modelRunner.js';
import { createExperiment } from '../services/api.js';
import { saveSnapshotLocal } from '../services/localRepository.js';
let active = false;
let cancelled = false;
export function stopSweep() { cancelled = true; modelRunner.stop(); }
export async function executeSweep(manifest, source, onProgress = () => {}) {
  if (active || modelRunner.activeJobId) throw new Error('Another training job or sweep is active.');
  if (manifest.totalJobs > 50 || !source?.hyperparameters?.layers || !source.evaluation?.membership) throw new Error('Choose a saved Studio run with recorded split membership.');
  active = true; cancelled = false;
  const snapshot = structuredClone(manifest);
  const rows = source.dataset.points;
  const membership = source.evaluation.membership;
  const select = ids => ids.map(id => rows.find(p => String(p.id) === id));
  const persist = async () => { await saveSnapshotLocal({ id: 'last-sweep', manifest: snapshot, source }); onProgress(structuredClone(snapshot)); };
  try {
    snapshot.status = 'running'; await persist();
    for (const job of snapshot.jobs) {
      if (cancelled) break;
      if (job.status === 'completed') continue;
      job.status = 'running'; await persist();
      try {
        const result = await modelRunner.runTraining({ layers: source.hyperparameters.layers, trainPoints: select(membership.train), valPoints: select(membership.validation), epochs: job.config.epochs, batchSize: job.config.batchSize, learningRate: job.config.learningRate, optimizer: source.hyperparameters.optimizer, seed: job.seed });
        if (result.status === 'cancelled') { job.status = 'pending'; break; }
        const last = result.losses.at(-1);
        const run = await createExperiment({ ...source, domain: undefined, runId: snapshot.sweepId + '-' + job.jobId, parentRunId: source.runId || source.domain?.run.id, name: 'Sweep ' + job.configId + ' seed ' + job.seed, hyperparameters: { ...source.hyperparameters, ...job.config, seed: job.seed }, metrics: { trainLoss: last.loss, valLoss: last.valLoss, trainAccuracy: last.accuracy, valAccuracy: last.valAccuracy }, metricHistory: result.losses, modelArtifact: result.artifact, status: 'Completed' });
        job.status = 'completed'; job.metrics = run.metrics; job.runId = run._id; job.error = null;
      } catch (error) { job.status = 'failed'; job.error = error.message; }
      finally { modelRunner.dispose(); }
      await persist();
    }
    snapshot.status = cancelled ? 'cancelled' : snapshot.jobs.some(job => job.status === 'failed') ? 'failed' : 'completed';
    await persist(); return snapshot;
  } finally { active = false; }
}
