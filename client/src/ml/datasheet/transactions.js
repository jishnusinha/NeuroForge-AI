import { validateDataSheet, columnKinds, isSheetMissing, SHEET_MAX_ROWS, SHEET_MAX_COLUMNS } from './gridModel.js';

export const MAX_SHEET_BYTES = 2 * 1024 * 1024;
export function boundedSheet(data) {
  validateDataSheet(data);
  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_SHEET_BYTES)
    throw new Error('F17_DATA_TOO_LARGE: Maximum dataset size is 2 MiB.');
  return data;
}

export function typedValue(text, kind, previous) {
  if (typeof text !== 'string') throw new Error('F17_INVALID_INPUT');
  if (text === '') return null;
  const numeric = kind === 'numeric' || (kind === 'mixed' && typeof previous === 'number');
  if (numeric) {
    if (!text.trim() || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim()) || !Number.isFinite(Number(text)))
      throw new Error('F17_INVALID_NUMBER: Enter a finite number or clear the cell.');
    return Number(text);
  }
  return text;
}

// RFC-style quoted clipboard fields preserve tabs, newlines and quotes.
export function parseTSV(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_SHEET_BYTES)
    throw new Error('F17_PASTE_TOO_LARGE');
  const result = []; let row = [], token = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quoted || token === '')) {
      if (quoted && text[i + 1] === '"') { token += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === '\t' || c === '\n' || c === '\r')) {
      row.push(token); token = '';
      if(row.length>SHEET_MAX_COLUMNS)throw new Error('F17_PASTE_OUT_OF_BOUNDS');
      if (c !== '\t') { result.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
      if(result.length>SHEET_MAX_ROWS)throw new Error('F17_PASTE_OUT_OF_BOUNDS');
    } else token += c;
  }
  if (quoted) throw new Error('F17_MALFORMED_CLIPBOARD');
  if (row.length || token || !result.length) { row.push(token); result.push(row); }
  if(result.length>SHEET_MAX_ROWS||result.some(r=>r.length>SHEET_MAX_COLUMNS))throw new Error('F17_PASTE_OUT_OF_BOUNDS');
  if (result.some(r => r.length !== result[0].length)) throw new Error('F17_PASTE_NOT_RECTANGULAR');
  return result;
}

export function applyCells(source, current, edits) {
  validateWorkingCopy(source, current);
  if(!Array.isArray(edits)||edits.length>SHEET_MAX_ROWS*SHEET_MAX_COLUMNS)throw new Error('F17_TRANSACTION_TOO_LARGE');
  const kinds = columnKinds(source), byId = new Map(current.rows.map(r => [r.id, r]));
  const originals=new Map(source.rows.map(r=>[r.id,r]));
  const patches = new Map();
  for (const { rowId, column, text } of edits) {
    const index = source.headers.indexOf(column), row = byId.get(rowId);
    if (index < 0 || !row) throw new Error('F17_UNKNOWN_CELL');
    const original = originals.get(rowId);
    const value = typedValue(text, kinds[index].kind, original[column]);
    const patch = patches.get(rowId) || { ...row };
    patch[column] = value; patches.set(rowId, patch);
  }
  return boundedSheet({ headers: [...current.headers], rows: current.rows.map(r => patches.get(r.id) || r) });
}

export function rangeCells(rows, headers, anchor, end) {
  const ar = rows.findIndex(r => r.id === anchor?.rowId), br = rows.findIndex(r => r.id === end?.rowId);
  const ac = headers.indexOf(anchor?.column), bc = headers.indexOf(end?.column);
  if (Math.min(ar, br, ac, bc) < 0) return [];
  return rows.slice(Math.min(ar, br), Math.max(ar, br) + 1).map(row =>
    headers.slice(Math.min(ac, bc), Math.max(ac, bc) + 1).map(column => ({ rowId: row.id, column, value: row[column] })));
}

export function rangeStats(cells) {
  const values = cells.flat().map(c => c.value), numbers = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  const sum = numbers.reduce((a, b) => a + b, 0);
  return { count: values.filter(v => !isSheetMissing(v)).length, missing: values.filter(isSheetMissing).length,
    numeric: numbers.length, sum, mean: numbers.length ? sum / numbers.length : null };
}

const safeText = v => {
  const text = isSheetMissing(v) ? '' : String(v);
  // eslint-disable-next-line no-control-regex
  return typeof v === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" + text : text;
};
export function delimitedExport(matrix, delimiter = ',') {
  return matrix.map(row => row.map(value => {
    const text = safeText(value);
    return text.includes(delimiter) || /["\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }).join(delimiter)).join('\r\n');
}

// A terminal record separator preserves a trailing all-missing row when a
// spreadsheet adds or strips its conventional final newline on paste.
export const clipboardTSV=matrix=>delimitedExport(matrix,'\t')+'\r\n';

export function sheetChanges(source, current) {
  const original = new Map(source.rows.map(r => [r.id, r]));
  return current.rows.flatMap(row => source.headers.filter(column => !Object.is(original.get(row.id)?.[column], row[column]))
    .map(column => ({ rowId: row.id, column, before: original.get(row.id)?.[column], after: row[column] })));
}

export async function sheetFingerprint(data) {
  boundedSheet(data);
  const text = JSON.stringify([data.headers, data.rows.map(r => [r.id, ...data.headers.map(h => r[h] ?? null)])]);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function commitSheet(source, current) {
  validateWorkingCopy(source, current);
  if (!sheetChanges(source, current).length) throw new Error('F17_NO_CHANGES');
  const parentFingerprint = await sheetFingerprint(source), fingerprint = await sheetFingerprint(current);
  const versionId = globalThis.crypto.randomUUID();
  return { headers: [...current.headers], rows: current.rows.map(row => ({ ...row })), rowCount: current.rows.length,
    provenance: { kind: 'neuroforge-dataset-version', versionId, parentFingerprint, fingerprint,
      createdAt: new Date().toISOString(), changedCells: sheetChanges(source, current).length } };
}

export function validateWorkingCopy(source, current) {
  boundedSheet(source); boundedSheet(current);
  if (JSON.stringify(source.headers) !== JSON.stringify(current.headers) ||
      source.rows.length !== current.rows.length || source.rows.some((r, i) => r.id !== current.rows[i].id))
    throw new Error('F17_WORKING_COPY_IDENTITY_MISMATCH');
  const kinds = columnKinds(source);
  for (let i = 0; i < current.rows.length; i++) {
    for (let c = 0; c < current.headers.length; c++) {
      const h = current.headers[c], value = current.rows[i][h], original = source.rows[i][h];
      if (value == null || Object.is(value, original)) continue;
      if ((kinds[c].kind === 'numeric' || (kinds[c].kind === 'mixed' && typeof original === 'number')) && typeof value !== 'number')
        throw new Error('F17_INVALID_NUMBER');
      if ((kinds[c].kind === 'categorical' || kinds[c].kind === 'empty' ||
          (kinds[c].kind === 'mixed' && typeof original !== 'number')) && typeof value !== 'string') throw new Error('F17_INVALID_CATEGORY');
    }
  }
  return current;
}
