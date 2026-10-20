import { pearsonPairwise, histogram } from './datasetProfiling.js';

/** Average ranks preserve ties; unavailable results are not represented as zero. */
function averageRanks(values) {
  const ranked = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = Array(values.length);
  for (let start = 0; start < ranked.length;) {
    let end = start + 1;
    while (end < ranked.length && ranked[end].value === ranked[start].value) end++;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index++) ranks[ranked[index].index] = rank;
    start = end;
  }
  return ranks;
}

export function spearmanPairwise(rows, first, second) {
  const observed = rows.filter(row => Number.isFinite(row[first]) && Number.isFinite(row[second]));
  const count = observed.length;
  if (count < 3) return { r: null, count };
  const x = averageRanks(observed.map(row => row[first]));
  const y = averageRanks(observed.map(row => row[second]));
  return pearsonPairwise(x.map((value, i) => ({ x: value, y: y[i] })), 'x', 'y');
}

export function correlationEvidence(dataset, numericColumns, method = 'pearson') {
  if (!dataset?.headers || !Array.isArray(dataset.rows)) throw new Error('EDA_INVALID_DATASET');
  if (!['pearson', 'spearman'].includes(method)) throw new Error('EDA_UNKNOWN_CORRELATION_METHOD');
  const columns = [...new Set(numericColumns)].filter(name => dataset.headers.includes(name)).slice(0, 12);
  const fn = method === 'spearman' ? spearmanPairwise : pearsonPairwise;
  return {
    method, columns, rowCount: dataset.rows.length,
    status: columns.length >= 2 ? 'ok' : 'unavailable',
    matrix: columns.map(x => columns.map(y => {
      const { r, count } = fn(dataset.rows, x, y);
      return { x, y, r, count, status: r === null ? 'unavailable' : 'ok' };
    })),
  };
}

export function distributionEvidence(rows, name, type, bins = 10) {
  const observed = rows.map(row => row[name]).filter(value => value !== null && value !== undefined && value !== '' && !(typeof value === 'number' && !Number.isFinite(value)));
  if (type === 'numeric') {
    const numeric = observed.filter(Number.isFinite);
    return { type, observed: numeric.length, missing: rows.length - numeric.length,
      bins: histogram(numeric, bins), method: 'Equal-width observed numeric histogram', status: numeric.length ? 'ok' : 'unavailable' };
  }
  const counts = new Map();
  for (const value of observed) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const categories = sorted.slice(0, 12).map(([label, count]) => ({ label, count }));
  if (sorted.length > 12) categories.push({ label: 'Other categories', count: sorted.slice(12).reduce((sum, row) => sum + row[1], 0) });
  return { type, observed: observed.length, missing: rows.length - observed.length, categories, method: 'Exact categorical counts', status: observed.length ? 'ok' : 'unavailable' };
}
