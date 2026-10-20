// Exact experimental evidence: never infer missing metrics from adjacent epochs.
export function recordedMetricRows(histories, fields) {
  const lookups = histories.map(history => new Map(
    (history || []).filter(item => Number.isFinite(item?.epoch)).map(item => [item.epoch, item])
  ));
  const epochs = [...new Set(lookups.flatMap(lookup => [...lookup.keys()]))].sort((a, b) => a - b);
  return epochs.map(epoch => ({
    epoch,
    values: lookups.flatMap(lookup => fields.map(field => {
      const value = lookup.get(epoch)?.[field];
      return Number.isFinite(value) ? value : null;
    })),
  }));
}

// Missing values and unrecorded intermediate epochs break the graph.
export function metricHistoryPath(history, field, maxEpoch, maxValue) {
  const rows = [...(history || [])].filter(item => Number.isFinite(item?.epoch)).sort((a, b) => a.epoch - b.epoch);
  const sx = Number.isFinite(maxEpoch) && maxEpoch > 0 ? maxEpoch : 1;
  const sy = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  let path = '';
  let last = null;
  for (const row of rows) {
    if (!Number.isFinite(row[field])) { last = null; continue; }
    const continuous = last !== null && row.epoch === last + 1;
    path += `${continuous ? ' L' : ' M'} ${20 + row.epoch / sx * 560} ${180 - row[field] / sy * 160}`;
    last = row.epoch;
  }
  return path.trim();
}
