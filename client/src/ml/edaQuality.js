import { profileDataset } from './datasetProfiling.js';
import { tukeyOutliers } from './datasetInsights.js';
import { isMissingValue } from './edaFilters.js';

/**
 * Descriptive review prompts, not cleaning commands or assertions of bad data.
 * Row IDs identify observed evidence; no original row is changed.
 */
export function qualityEvidence(dataset) {
  if (!dataset?.headers || !Array.isArray(dataset.rows)) throw new Error('EDA_INVALID_DATASET');
  const report = profileDataset(dataset);
  const findings = [];
  const add = (id, column, severity, label, count, rowIds = [], method = '') =>
    findings.push({ id, column, severity, label, count, rowIds: rowIds.slice(0, 30), method });
  const rows = dataset.rows;
  const rowId = (row, index) => String(row.id ?? 'row-' + (index + 1));
  if (report.duplicateRows) {
    const seen = new Set(), duplicates = [];
    rows.forEach((row, index) => {
      const key = JSON.stringify(dataset.headers.map(column => row[column] ?? null));
      if (seen.has(key)) duplicates.push(rowId(row, index));
      else seen.add(key);
    });
    add('exact-duplicates', null, 'review', 'Exact duplicate source records', duplicates.length,
      duplicates, 'Equality across original columns, excluding generated row IDs');
  }
  for (const column of report.columns) {
    const name = column.name;
    const missingIds = rows.flatMap((row, index) => isMissingValue(row[name]) ? [rowId(row, index)] : []);
    if (missingIds.length) add('missing:' + name, name, 'review', 'Missing observations in ' + name,
      missingIds.length, missingIds, 'Null, blank or non-finite cells');
    if (column.present && column.unique === 1)
      add('constant:' + name, name, 'notice', 'Constant observed column: ' + name, column.present, [], 'One distinct present value');
    const counts = new Map();
    let numericCount = 0, textCount = 0;
    for (const row of rows) {
      const value = row[name];
      if (isMissingValue(value)) continue;
      const key = typeof value + ':' + String(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (typeof value === 'number' && Number.isFinite(value)) numericCount++;
      else textCount++;
    }
    if (numericCount && textCount)
      add('mixed:' + name, name, 'review', 'Mixed numeric and text observations: ' + name,
        textCount, [], 'Observed source value types');
    const highest = Math.max(0, ...counts.values());
    if (column.present >= 10 && column.unique > 1 && highest / column.present >= 0.95)
      add('near-constant:' + name, name, 'notice', 'One value dominates at least 95% of ' + name,
        highest, [], 'Mode frequency / observed count');
    if (column.type === 'categorical' && column.unique > 12)
      add('cardinality:' + name, name, 'notice', 'High-cardinality category: ' + name,
        column.unique, [], 'More than 12 observed categories');
    if (rows.length >= 10 && column.unique / rows.length >= 0.95)
      add('identifier:' + name, name, 'notice', 'Potential identifier-like column: ' + name,
        column.unique, [], 'Distinct values / source row count at least 95%');
    if (column.type === 'numeric') {
      const outliers = tukeyOutliers(rows, name);
      if (outliers.available && outliers.count)
        add('outliers:' + name, name, 'review', 'Tukey IQR outlier candidates: ' + name,
          outliers.count, outliers.examples.map(row => String(row.id)),
          'Observed values beyond 1.5 × IQR fences');
    }
  }
  return { rowCount: rows.length, status: 'ok', findings, method: 'Read-only descriptive data-quality inspection' };
}
