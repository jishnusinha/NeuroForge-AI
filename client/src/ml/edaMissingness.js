import { isMissingValue } from './edaFilters.js';

/** Every count uses all eligible observations; the visual matrix is bounded. */
export function missingnessEvidence(dataset, selectedColumns = dataset?.headers ?? [], maxDisplayed = 80) {
  if (!dataset?.headers || !Array.isArray(dataset.rows)) throw new Error('EDA_MISSINGNESS_REQUIRES_DATASET');
  const columns = [...new Set(selectedColumns)].filter(name => dataset.headers.includes(name)).slice(0, 20);
  const rows = dataset.rows;
  const columnCounts = columns.map(name => ({
    column: name, missing: rows.reduce((sum, row) => sum + Number(isMissingValue(row[name])), 0),
    observed: rows.reduce((sum, row) => sum + Number(!isMissingValue(row[name])), 0),
  }));
  const complete = rows.filter(row => columns.every(name => !isMissingValue(row[name]))).length;
  const coMissing = columns.map(a => columns.map(b =>
    rows.reduce((sum, row) => sum + Number(isMissingValue(row[a]) && isMissingValue(row[b])), 0)));
  const safeLimit = Number.isFinite(maxDisplayed) ? Math.max(1, Math.min(80, Math.floor(maxDisplayed))) : 80;
  const stride = Math.max(1, Math.ceil(rows.length / safeLimit));
  const displayRows = rows.map((row, index) => ({ row, index })).filter((_, index) => index % stride === 0)
    .slice(0, safeLimit).map(({ row, index }) => ({
      id: String(row.id ?? 'row-' + (index + 1)), number: index + 1,
      missing: columns.map(name => isMissingValue(row[name])),
    }));
  return {
    method: 'Exact observed missingness (no imputation)',
    status: columns.length ? 'ok' : 'unavailable',
    sourceCount: rows.length,
    complete, incomplete: rows.length - complete,
    columns: columnCounts, coMissing, displayedCount: displayRows.length, displayRows,
  };
}
