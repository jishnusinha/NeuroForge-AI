import test from 'node:test';
import assert from 'node:assert/strict';
import {detectCsvDelimiter,parseAndValidateCSV,parseCsvRecords,profileRows,safeHeaders} from '../client/src/ml/datasetImport.js';
import {ACADEMY_CASES,academyCsv,academyPython,generateAcademyCase} from '../client/src/academy/cases/catalog.js';
import {THEMES} from '../client/src/theme/themeConfig.js';

test('CSV compatibility reader handles BOM, quoted delimiters, escaped quotes, embedded newlines and inert formulas',()=>{
 const source='\uFEFFname;value;note\r\n"A; B";1,25;"two lines\r\nand ""quotes"""\r\n=SUM(A1:A2);2,5;plain';
 const records=parseCsvRecords(source,';');
 assert.equal(records[0][0],'name');assert.equal(records[1][0],'A; B');assert.equal(records[1][2],'two lines\r\nand "quotes"');assert.equal(records[2][0],'=SUM(A1:A2)');
 assert.equal(detectCsvDelimiter('a;b;c\n1;2;3\n4;5;6'),';');
});

test('headers receive stable safe names and whole-row profile uses online numeric summaries',()=>{
 assert.deepEqual(safeHeaders(['__proto__','x','x','']),['Column 1','x','x (2)','Column 4']);
 const data=parseAndValidateCSV('x,y,label\n1,2,=1+1\n2,4,no\n3,6,yes\n4,8,no',{requiredNumericCols:2});
 assert.equal(data.summary[0].mean,2.5);assert.equal(data.summary[0].scope,'preview');assert.equal(data.rows[0].label,'=1+1');
 const profile=profileRows(['a'],[{a:1},{a:3},{a:null}]);assert.equal(profile[0].mean,2);assert.equal(profile[0].variance,2);assert.equal(profile[0].missingCount,1);
});

test('all ten Academy generators are seeded, schema matched, downloadable and finite',()=>{
 assert.equal(ACADEMY_CASES.length,10);
 for(const spec of ACADEMY_CASES){
  const first=generateAcademyCase(spec.id),second=generateAcademyCase(spec.id);assert.deepEqual(first.rows,second.rows);assert.equal(first.rows.length,spec.rows);
  const keys=Object.keys(first.rows[0]);assert.deepEqual(keys,[...spec.features,...(spec.target?[spec.target]:[])]);
  for(const row of first.rows)for(const key of keys)if(typeof row[key]==='number')assert.ok(Number.isFinite(row[key]));
  const csv=academyCsv(spec,first.rows),parsed=parseCsvRecords(csv);assert.equal(parsed.length,spec.rows+1);assert.equal(parsed[0].length,keys.length);assert.deepEqual(parsed[1],keys.map(key=>String(first.rows[0][key])));
  const python=academyPython(spec);assert.ok(python.includes(`${spec.id}.csv`));assert.ok(python.includes('train_test_split')||!spec.target);assert.equal(python.includes('labels = model.fit_predict(X)'),!spec.target);
 }
 const imbalance=generateAcademyCase('manufacturing-defects').rows.filter(row=>row.defect===1).length;assert.ok(imbalance>=25&&imbalance<500);
});

test('the appearance picker exposes exactly ten stable themes with mode and usable palette swatches',()=>{
 assert.equal(THEMES.length,10);assert.deepEqual(THEMES.slice(0,4).map(theme=>theme.id),['midnight','slate','forest','paper']);
 assert.deepEqual(new Set(THEMES.map(theme=>theme.id)).size,10);
 for(const theme of THEMES){assert.ok(['light','dark'].includes(theme.mode));assert.equal(theme.swatches.length,4);}
 assert.equal(THEMES.filter(theme=>theme.mode==='light').length,4);
});
