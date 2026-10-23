/** Small-file compatibility parser. Large local files use csvImportWorker.js. */
export function parseAndValidateCSV(csvText, options = {}) {
  const { maxRows = 2000, maxCols = 20, requiredNumericCols = 2 } = options;
  if (typeof csvText !== 'string' || !csvText.trim()) throw new Error('CSV_EMPTY: The selected file is empty.');
  const rows = parseCsvRecords(csvText, ',');
  if (rows.length < 5) throw new Error('CSV_TOO_FEW_ROWS: Include a header and at least four data rows.');
  if (rows.length - 1 > maxRows) throw new Error('CSV_EXCEEDS_MAX_ROWS');
  const headers = safeHeaders(rows[0]);
  if (headers.length < 2) throw new Error('CSV_INVALID_COLUMNS');
  if (headers.length > maxCols) throw new Error(`CSV_EXCEEDS_MAX_COLS: Choose a file with at most ${maxCols} columns.`);
  const parsedRows = rows.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV_MALFORMED_ROW: Record ${index + 2} has ${cells.length} fields; expected ${headers.length}.`);
    const row = { id: `sample-${index}` };
    headers.forEach((header, col) => { row[header] = coerce(cells[col]); }); return row;
  });
  const summary = profileRows(headers, parsedRows);
  const numeric = summary.filter(col => col.type === 'numeric');
  if (numeric.length < requiredNumericCols) throw new Error(`CSV_INSUFFICIENT_NUMERIC_FEATURES: Need ${requiredNumericCols} numeric columns, found ${numeric.length}.`);
  return { headers, originalHeaders: rows[0], rows: parsedRows, summary, rowCount: parsedRows.length };
}

export function parseCsvRecords(text, delimiter = ',', quoteChar='"') {
  const records=[];let row=[],cell='',quoted=false;
  const source=text.charCodeAt(0)===0xfeff?text.slice(1):text;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch===quoteChar){
      if(quoted&&source[i+1]===quoteChar){cell+=quoteChar;i++;}
      else if(!quoted&&cell==='')quoted=true;
      else if(quoted)quoted=false;
      else cell+='"';
    } else if(!quoted&&ch===delimiter){row.push(cell);cell='';}
    else if(!quoted&&(ch==='\r'||ch==='\n')){row.push(cell);cell='';if(row.some(v=>v!==''))records.push(row);row=[];if(ch==='\r'&&source[i+1]==='\n')i++;}
    else cell+=ch;
  }
  if(quoted)throw new Error('CSV_MALFORMED_QUOTES: A quoted field was not closed.');
  row.push(cell);if(row.some(v=>v!==''))records.push(row);return records;
}

export function detectCsvDelimiter(sample,quoteChar='"') {
  const candidates=[',',';','\t'];let best=',',bestScore=-Infinity;
  for(const delimiter of candidates){
    try{let text=sample,rows;while(text){try{rows=parseCsvRecords(text,delimiter,quoteChar);break;}catch{const end=text.lastIndexOf('\n');if(end<0)break;text=text.slice(0,end);}}if(!rows)continue;rows=rows.slice(0,40);const counts=rows.map(row=>row.length);const width=counts.sort((a,b)=>a-b)[Math.floor(counts.length/2)]||1;const consistent=counts.filter(n=>n===width).length/Math.max(1,counts.length);const score=width>1?width*consistent:0;if(score>bestScore){bestScore=score;best=delimiter;}}catch{/* An incomplete quote in the bounded prefix is expected. */}
  }
  return best;
}

export function safeHeaders(original) {
  const used=new Set();
  return original.map((value,index)=>{
    let name=String(value??'').replace(/^\uFEFF/,'').trim();
    if(!name||['__proto__','prototype','constructor','id','sourceRowNumber'].includes(name))name=`Column ${index+1}`;
    const base=name;let suffix=2;while(used.has(name))name=`${base} (${suffix++})`;
    used.add(name);return name;
  });
}

export function coerce(value) {
  if(value===''||/^(null|nan)$/i.test(value))return null;
  const number=Number(value);return Number.isFinite(number)&&value.trim()!==''?number:value;
}

export function profileRows(headers, rows) {
  return headers.map(name=>{
    let numeric=0,missing=0,count=0,mean=0,m2=0,min=Infinity,max=-Infinity;
    for(const row of rows){const value=row[name];if(value==null||value===''){missing++;continue;}count++;if(typeof value==='number'&&Number.isFinite(value)){numeric++;const delta=value-mean;mean+=delta/numeric;m2+=delta*(value-mean);min=Math.min(min,value);max=Math.max(max,value);}}
    const isNumeric=numeric>0&&numeric/Math.max(1,count)>=.8;
    return {name,type:isNumeric?'numeric':count?'categorical':'empty',count,missingCount:missing,
      min:isNumeric?min:null,max:isNumeric?max:null,mean:isNumeric?mean:null,
      variance:isNumeric&&numeric>1?m2/(numeric-1):isNumeric?0:null,scope:'preview'};
  });
}
