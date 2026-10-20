/**
 * Bounded, pure exploratory statistics for browser-only tabular datasets.
 * Evidence uses only observed finite numbers. Never infer missing values or causal effects.
 */
export function quantile(sorted, probability) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function frequency(values, limit) {
  const counts = new Map();
  for (const value of values) {
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, limit).map(([label,count]) => ({ label,count }));
  if (sorted.length > limit) top.push({ label: 'Other categories', count: sorted.slice(limit).reduce((total,row)=>total+row[1],0) });
  return top;
}

export function histogram(values, requestedBins = 8) {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!sorted.length) return [];
  const min = sorted[0], max = sorted.at(-1);
  if (min === max) return [{ from:min, to:max, count:sorted.length }];
  const bins = Math.min(Math.max(1,Math.floor(requestedBins)), 16);
  const width = (max-min)/bins;
  const counts = Array(bins).fill(0);
  for (const value of sorted) counts[Math.min(bins-1, Math.floor((value-min)/width))]++;
  return counts.map((count,index) => ({ from:min+index*width, to:index===bins-1?max:min+(index+1)*width, count }));
}

export function pearsonPairwise(rows, first, second) {
  const pairs = rows.filter(row => Number.isFinite(row[first]) && Number.isFinite(row[second]));
  const count = pairs.length;
  if (count < 3) return { r:null, count };
  const avgX = pairs.reduce((s,row)=>s+row[first],0)/count;
  const avgY = pairs.reduce((s,row)=>s+row[second],0)/count;
  let numerator = 0, xx = 0, yy = 0;
  for (const row of pairs) {
    const x = row[first]-avgX, y = row[second]-avgY;
    numerator += x*y; xx += x*x; yy += y*y;
  }
  const denominator = Math.sqrt(xx*yy);
  return { r: denominator > 0 && Number.isFinite(denominator) ? Math.max(-1,Math.min(1,numerator/denominator)) : null, count };
}

export function profileDataset(dataset) {
  if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) {
    throw new Error('PROFILE_REQUIRES_PARSED_DATASET');
  }
  const {headers,rows} = dataset;
  const columns = headers.map(name => {
    const present = rows.map(row=>row[name]).filter(value=>value!==null && value!==undefined && value!=='');
    const numeric = present.filter(Number.isFinite);
    const type = present.length && numeric.length/present.length >= .8 ? 'numeric' : 'categorical';
    const sorted = numeric.slice().sort((a,b)=>a-b);
    const sum = numeric.reduce((a,b)=>a+b,0);
    const mean = sorted.length ? sum/sorted.length : null;
    const variance = sorted.length > 1 ? numeric.reduce((a,b)=>a+(b-mean)**2,0)/(sorted.length-1) : null;
    return {
      name, type, count:rows.length, present:present.length, missing:rows.length-present.length,
      unique:new Set(present.map(value=>typeof value+':'+String(value))).size,
      min:type==='numeric'&&sorted.length?sorted[0]:null,
      max:type==='numeric'&&sorted.length?sorted.at(-1):null,
      mean:type==='numeric'?mean:null,
      median:type==='numeric'?quantile(sorted,.5):null,
      q1:type==='numeric'?quantile(sorted,.25):null,
      q3:type==='numeric'?quantile(sorted,.75):null,
      standardDeviation:type==='numeric'&&variance!==null?Math.sqrt(variance):null,
      histogram:type==='numeric'?histogram(numeric):[],
      categories:type==='categorical'?frequency(present,8):[],
    };
  });
  const fingerprints = new Set(); let duplicates=0;
  for (const row of rows) {
    const fingerprint = JSON.stringify(headers.map(key=>row[key]??null));
    if (fingerprints.has(fingerprint)) duplicates++;
    else fingerprints.add(fingerprint);
  }
  const numericNames=columns.filter(column=>column.type==='numeric').map(column=>column.name).slice(0,8);
  const correlations=numericNames.map(x=>numericNames.map(y=>pearsonPairwise(rows,x,y)));
  return {
    rowCount:rows.length, columnCount:headers.length, missingCells:columns.reduce((sum,column)=>sum+column.missing,0),
    duplicateRows:duplicates, columns, numericNames, correlations,
  };
}
