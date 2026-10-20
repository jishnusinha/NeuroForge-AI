import { canonical } from '../../../shared/domain.mjs';

export function fingerprint(points) {
  let hash = 2166136261;
  for (const char of JSON.stringify(points.map(({ id, x, y, label }) => ({ id, x, y, label })).sort((a, b) => String(a.id).localeCompare(String(b.id))))) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function comparisonCompatible(a, b) {
  if (a?.compatibilityIssues?.length || b?.compatibilityIssues?.length) return false;
  if (a?.domain?.evaluationProtocol?.membership && b?.domain?.evaluationProtocol?.membership) {
    return a.task === b.task && a.task !== 'clustering' &&
      a.domain.datasetVersion.contentDigest === b.domain.datasetVersion.contentDigest &&
      a.domain.evaluationProtocol.contentDigest === b.domain.evaluationProtocol.contentDigest &&
      canonical(a.domain.evaluationProtocol.preprocessing) === canonical(b.domain.evaluationProtocol.preprocessing);
  }
  if (!a?.dataset?.fingerprint || !b?.dataset?.fingerprint) return false;
  return a.task === b.task && a.task !== 'clustering' &&
    a.dataset.fingerprint === b.dataset.fingerprint &&
    a.dataset.splitFingerprint === b.dataset.splitFingerprint &&
    Boolean(a.dataset.splitFingerprint) && a.dataset.preprocessing === b.dataset.preprocessing;
}

export function metricAt(run, epoch) {
  const row = (run.metricHistory || []).filter(h => h.epoch <= epoch).at(-1);
  if (row) return { loss: row.loss ?? null, valLoss: row.valLoss ?? null, acc: row.valAccuracy ?? null };
  if (run.metricHistory?.length) return { loss: null, valLoss: null, acc: null };
  return { loss: run.metrics?.trainLoss ?? run.metrics?.mse ?? null,
    valLoss: run.metrics?.valLoss ?? run.metrics?.testMse ?? null, acc: run.metrics?.valAccuracy ?? null };
}

export function detectsOverfitting(run) {
  const history = (run.metricHistory || []).filter(h => Number.isFinite(h.loss) && Number.isFinite(h.valLoss));
  if (history.length < 3) return false;
  const best = history.reduce((a, b) => a.valLoss < b.valLoss ? a : b);
  const last = history.at(-1);
  return last.epoch > best.epoch && last.valLoss > best.valLoss * 1.1 && last.loss < best.loss;
}
