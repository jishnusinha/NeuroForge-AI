import { quantile } from './datasetProfiling.js';

// EDA evidence is descriptive: do not impute, discard, or mutate observed rows.
const present = value => value !== null && value !== undefined && value !== '';

export function eligibleGroupColumns(report, maxDistinct = 12) {
  return report.columns.filter(column => column.present > 0 && column.unique >= 2 &&
    column.unique <= maxDistinct).map(column => column.name);
}

export function scatterEvidence(rows, xKey, yKey, groupKey = '', maxPoints = 400) {
  const valid = [];
  rows.forEach((row, index) => {
    if (Number.isFinite(row[xKey]) && Number.isFinite(row[yKey])) {
      valid.push({
        id: row.id ?? `row-${index + 1}`,
        rowNumber: index + 1,
        x: row[xKey], y: row[yKey],
        group: groupKey ? (present(row[groupKey]) ? String(row[groupKey]) : 'Missing') : 'All rows',
      });
    }
  });
  const safeLimit = Math.min(400, Math.max(1, Math.floor(maxPoints) || 400));
  const stride = Math.max(1, Math.ceil(valid.length / safeLimit));
  const points = valid.filter((_row, index) => index % stride === 0).slice(0, safeLimit);
  const minMax = key => {
    if (!valid.length) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    for (const row of valid) { min = Math.min(min, row[key]); max = Math.max(max, row[key]); }
    return min === max ? { min: min - .5, max: max + .5 } : { min, max };
  };
  const groups = [...new Set(valid.map(row => row.group))].sort((a,b)=>a.localeCompare(b));
  return {
    count: valid.length, excluded: rows.length - valid.length,
    sampled: points.length, points, groups,
    xDomain: minMax('x'), yDomain: minMax('y'),
  };
}

export function classBalance(rows, column, maxDistinct = 12) {
  if (!column) return { available: false, reason: 'Choose a class or category column.' };
  const counts = new Map(); let missing = 0;
  rows.forEach(row => {
    const value = row[column];
    if (!present(value)) { missing++; return; }
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  if (!counts.size) return { available: false, missing, reason: 'No observed class labels.' };
  if (counts.size > maxDistinct) return { available: false, missing, reason: 'More than 12 distinct labels; choose a lower-cardinality column.' };
  const categories = [...counts].map(([label,count]) => ({label,count}))
    .sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label));
  const observed = categories.reduce((sum,item)=>sum+item.count,0);
  const majority = categories[0];
  const minority = categories.at(-1);
  return {
    available: true, categories: categories.map(item=>({...item, percentage: 100*item.count/observed})),
    missing, observed, majority, minority,
    ratio: majority.count / minority.count,
    status: categories.length === 1 ? 'single_class' : majority.count / minority.count >= 3 ? 'imbalanced' : 'not_flagged',
  };
}

export function tukeyOutliers(rows, key) {
  const observed = rows.map((row,index) => ({rowNumber:index+1, id:row.id ?? `row-${index+1}`,value:row[key]}))
    .filter(item=>Number.isFinite(item.value));
  const sorted = observed.map(item=>item.value).sort((a,b)=>a-b);
  const missing = rows.length-observed.length;
  if (observed.length < 4) return {available:false,count:0,observed:observed.length,missing,reason:'At least four observed numeric values are required.'};
  const q1=quantile(sorted,.25), q3=quantile(sorted,.75), iqr=q3-q1;
  if (!(iqr>0) || !Number.isFinite(iqr)) return {available:false,count:0,observed:observed.length,missing,reason:'The interquartile range is zero or not finite; whisker fences are not informative.'};
  const lower=q1-1.5*iqr, upper=q3+1.5*iqr;
  const flagged=observed.filter(row=>row.value<lower || row.value>upper);
  return {
    available:true, observed:observed.length, missing, q1,q3,iqr,lower,upper,
    count:flagged.length, percentage:100*flagged.length/observed.length,
    examples: flagged.slice(0,30),
  };
}

export function qualitySignals(report) {
  const signals = [];
  if (!report.rowCount) return [{id:'empty',label:'No rows to profile',severity:'notice'}];
  if (report.duplicateRows) signals.push({id:'duplicates',severity:'review',label:`${report.duplicateRows} exact duplicate row(s). Confirm whether repeated observations are intentional.`});
  const missing = report.columns.filter(column=>column.missing>0);
  if (missing.length) signals.push({id:'missing',severity:'review',label:`${report.missingCells} missing cell(s) across ${missing.length} column(s). Investigate missingness before choosing a preparation strategy.`});
  const constant = report.columns.filter(column=>column.present>0 && column.unique===1);
  if (constant.length) signals.push({id:'constant',severity:'notice',label:`${constant.length} column(s) have only one observed distinct value; correlation and training relevance may be limited.`});
  if (report.columns.some(column=>column.type==='numeric' && column.present<4)) signals.push({id:'sparse',severity:'notice',label:'Some numeric columns have fewer than four observed rows; outlier estimates may be unavailable.'});
  if (!signals.length) signals.push({id:'clear',severity:'notice',label:'No missing cells or exact duplicate rows detected. This is not a guarantee of data quality.'});
  return signals;
}
