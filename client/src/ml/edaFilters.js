/**
 * F10: Immutable, deterministic EDA filtering. Filters select observations;
 * they never mutate the imported dataset or the modeling pipeline.
 */
export const isMissingValue = value =>
  value === null || value === undefined || value === '' ||
  (typeof value === 'number' && !Number.isFinite(value));

const OPERATORS = new Set(['equals', 'contains', 'gte', 'lte', 'between', 'missing', 'present']);

export function validateEdaFilters(filters, headers) {
  if (!Array.isArray(filters) || !Array.isArray(headers) || filters.length > 20)
    throw new Error('EDA_INVALID_FILTERS');
  return filters.map((filter, index) => {
    if (!filter || !headers.includes(filter.column) || !OPERATORS.has(filter.operator))
      throw new Error('EDA_INVALID_FILTER: Choose an existing column and supported condition.');
    const id = String(filter.id ?? index);
    if (filter.operator === 'gte' || filter.operator === 'lte' || filter.operator === 'between') {
      const lower = Number(filter.value);
      const upper = filter.operator === 'between' ? Number(filter.valueTo) : null;
      if (filter.value === '' || filter.value === null || !Number.isFinite(lower) ||
          (filter.operator === 'between' && (filter.valueTo === '' || filter.valueTo === null || !Number.isFinite(upper) || lower > upper)))
        throw new Error('EDA_INVALID_FILTER_VALUE: Enter finite numeric bounds.');
      return { id, column: filter.column, operator: filter.operator, value: lower, ...(upper === null ? {} : { valueTo: upper }) };
    }
    if (filter.operator === 'equals' || filter.operator === 'contains') {
      if (filter.value === null || filter.value === undefined || String(filter.value) === '')
        throw new Error('EDA_INVALID_FILTER_VALUE: Enter a value to match.');
      return { id, column: filter.column, operator: filter.operator, value: String(filter.value) };
    }
    return { id, column: filter.column, operator: filter.operator };
  });
}

function matches(row, rule) {
  const value = row[rule.column];
  if (rule.operator === 'missing') return isMissingValue(value);
  if (rule.operator === 'present') return !isMissingValue(value);
  if (isMissingValue(value)) return false;
  if (rule.operator === 'equals') return String(value).toLocaleLowerCase() === rule.value.toLocaleLowerCase();
  if (rule.operator === 'contains') return String(value).toLocaleLowerCase().includes(rule.value.toLocaleLowerCase());
  if (!Number.isFinite(value)) return false;
  if (rule.operator === 'gte') return value >= rule.value;
  if (rule.operator === 'lte') return value <= rule.value;
  return value >= rule.value && value <= rule.valueTo;
}

export function applyEdaFilters(dataset, filters = []) {
  if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows))
    throw new Error('EDA_INVALID_DATASET');
  const rules = validateEdaFilters(filters, dataset.headers);
  const rows = rules.length ? dataset.rows.filter(row => rules.every(rule => matches(row, rule))) : dataset.rows;
  return { rows, rules, sourceCount: dataset.rows.length, visibleCount: rows.length, excludedCount: dataset.rows.length - rows.length };
}

export function sortEdaRows(rows, column, direction = 'asc') {
  if (!column) return [...rows];
  const sign = direction === 'desc' ? -1 : 1;
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const a = left.row[column], b = right.row[column];
    if (isMissingValue(a) || isMissingValue(b)) return isMissingValue(a) === isMissingValue(b) ? left.index - right.index : isMissingValue(a) ? 1 : -1;
    const comparison = typeof a === 'number' && typeof b === 'number'
      ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    return comparison ? Math.sign(comparison) * sign : left.index - right.index;
  }).map(item => item.row);
}
