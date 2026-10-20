/**
 * NeuroForge Bounded CSV Importer and Validator (Phase 6)
 * Safely parses, validates, and profiles tabular datasets with bounded sizes.
 */

export function parseAndValidateCSV(csvText, options = {}) {
  const {
    maxRows = 2000,
    maxCols = 20,
    requiredNumericCols = 2,
  } = options;

  if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
    throw new Error('CSV_EMPTY: Provided dataset is empty.');
  }

  if (csvText.length > 2 * 1024 * 1024) throw new Error('CSV_TOO_LARGE');
  const table=[]; let row=[], token='', quoted=false;
  for (let i=0;i<csvText.length;i++) {
    const char=csvText[i];
    if (char==='"') { if (quoted && csvText[i+1]==='"') { token+='"'; i++; } else quoted=!quoted; }
    else if (char===',' && !quoted) { row.push(token.trim()); token=''; }
    else if ((char==='\n'||char==='\r') && !quoted) { if(char==='\r'&&csvText[i+1]==='\n')i++; row.push(token.trim()); if(row.some(Boolean))table.push(row); row=[];token=''; }
    else token+=char;
  }
  if(quoted)throw new Error('CSV_MALFORMED_QUOTES');
  row.push(token.trim()); if(row.some(Boolean))table.push(row);
  if(table.length<5)throw new Error('CSV_TOO_FEW_ROWS: Header and 4 data rows required.');
  if(table.length-1>maxRows)throw new Error('CSV_EXCEEDS_MAX_ROWS');
  const headers=table[0];
  if(new Set(headers).size!==headers.length || headers.some(h=>!h||['id','__proto__','constructor','prototype'].includes(h)))throw new Error('CSV_INVALID_HEADERS');
  if(table.flat().some(value=>/^[=+@-]/.test(value)&&!Number.isFinite(Number(value))))throw new Error('CSV_REJECTED: Formula text is not accepted.');
  if (headers.length < 2) {
    throw new Error('CSV_INVALID_COLUMNS: CSV must have at least 2 comma-separated columns.');
  }
  if (headers.length > maxCols) {
    throw new Error(`CSV_EXCEEDS_MAX_COLS: Dataset has ${headers.length} columns. Max supported is ${maxCols}.`);
  }

  // Parse rows
  const parsedRows = [];
  const columnProfiles = headers.map(name => ({
    name,
    numericCount: 0,
    nullCount: 0,
    values: [],
  }));

  for (let r = 1; r < table.length; r++) {
    const rawTokens = table[r];
    if (rawTokens.length !== headers.length) {
      throw new Error(`CSV_MALFORMED_ROW: Row ${r} has ${rawTokens.length} columns, expected ${headers.length}.`);
    }

    const rowObj = { id: `sample-${r - 1}` };
    for (let c = 0; c < headers.length; c++) {
      const colName = headers[c];
      const valStr = rawTokens[c];

      if (valStr === '' || valStr.toLowerCase() === 'null' || valStr.toLowerCase() === 'nan') {
        rowObj[colName] = null;
        columnProfiles[c].nullCount++;
      } else {
        const num = Number(valStr);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
          rowObj[colName] = num;
          columnProfiles[c].numericCount++;
          columnProfiles[c].values.push(num);
        } else {
          rowObj[colName] = valStr; // categorical or text
        }
      }
    }
    parsedRows.push(rowObj);
  }

  // Compute column statistics
  const summary = columnProfiles.map(col => {
    const isNumeric = col.numericCount >= parsedRows.length * 0.8;
    let min = null, max = null, mean = null;
    if (isNumeric && col.values.length > 0) {
      min = Math.min(...col.values);
      max = Math.max(...col.values);
      mean = col.values.reduce((acc, v) => acc + v, 0) / col.values.length;
    }
    return {
      name: col.name,
      type: isNumeric ? 'numeric' : 'categorical',
      min,
      max,
      mean,
      missingCount: col.nullCount,
    };
  });

  const numericCols = summary.filter(c => c.type === 'numeric');
  if (numericCols.length < requiredNumericCols) {
    throw new Error(`CSV_INSUFFICIENT_NUMERIC_FEATURES: Need at least ${requiredNumericCols} numeric columns, found ${numericCols.length}.`);
  }

  return {
    headers,
    rows: parsedRows,
    summary,
    rowCount: parsedRows.length,
  };
}
