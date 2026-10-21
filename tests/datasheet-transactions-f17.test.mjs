import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCells, typedValue, parseTSV, rangeCells, rangeStats, delimitedExport, clipboardTSV, commitSheet, sheetFingerprint, validateWorkingCopy } from '../client/src/ml/datasheet/transactions.js';
import { defaultStudioRecipe } from '../client/src/ml/pipelineGraph.js';
import { executeStudioPipeline } from '../client/src/ml/pipelineExecutor.js';
import { createFeatureMatrix } from '../client/src/ml/modelWorkbench/featureMatrix.js';
import { fitWorkbenchModel } from '../client/src/ml/modelWorkbench/models.js';
import { createRunReceipt } from '../client/src/ml/modelRegistry/runContracts.js';
import { compareRunReceipts } from '../client/src/ml/modelRegistry/comparability.js';
const source = {headers:['amount','group'],rows:[{id:'r0',amount:1,group:'a'},{id:'r1',amount:null,group:'b'},{id:'r2',amount:3,group:'a'},{id:'r3',amount:4,group:'c'}]};

test('F17 typed editing preserves categorical numbers and validates missing numeric values',()=>{
  assert.equal(typedValue('001','categorical','a'),'001');
  assert.equal(typedValue('','numeric',1),null);
  assert.equal(typedValue('-1.5e2','numeric',1),-150);
  for(const text of [' ','NaN','Infinity','0x10','=2+2','abc']) assert.throws(()=>typedValue(text,'numeric',1));
  assert.equal(typedValue('=literal','categorical','a'),'=literal');
});
test('F17 paste is rectangular and quoted TSV round trips embedded tabs and newlines',()=>{
  assert.deepEqual(parseTSV('1\t"two\tthree"\r\n4\t"a\n""b"\n'),[['1','two\tthree'],['4','a\n"b']]);
  assert.deepEqual(parseTSV('\t'),[['','']]);
  assert.throws(()=>parseTSV('1\t2\n3'),/RECTANGULAR/);
  assert.throws(()=>parseTSV('"unfinished'),/MALFORMED/);
  assert.throws(()=>parseTSV(Array(21).fill('1').join('\t')),/OUT_OF_BOUNDS/);
  assert.throws(()=>parseTSV(Array(2001).fill('1').join('\n')),/OUT_OF_BOUNDS/);
});

test('F17 full-size rectangular transactions edit all 40,000 cells without mutating the source',()=>{
  const headers=Array.from({length:20},(_,i)=>'c'+i);
  const data={headers,rows:Array.from({length:2000},(_,i)=>({id:'r'+i,...Object.fromEntries(headers.map(h=>[h,1]))}))};
  const matrix=parseTSV(Array.from({length:2000},()=>Array(20).fill('2').join('\t')).join('\n'));
  const next=applyCells(data,data,matrix.flatMap((row,i)=>row.map((text,c)=>({rowId:'r'+i,column:headers[c],text}))));
  assert.equal(next.rows[1999].c19,2);assert.equal(data.rows[1999].c19,1);
  assert.equal(next.rows[0].c0,2);assert.equal(data.rows[0].c0,1);
});
test('F17 invalid atomic transaction never modifies any source or working cells',()=>{
  const before=structuredClone(source);
  assert.throws(()=>applyCells(source,source,[{rowId:'r0',column:'amount',text:'9'},{rowId:'r1',column:'amount',text:'oops'}]));
  assert.deepEqual(source,before);
  const next=applyCells(source,source,[{rowId:'r1',column:'amount',text:'9'}]);
  assert.equal(next.rows[1].amount,9);
  assert.deepEqual(source,before);
  assert.throws(()=>applyCells(source,next,[{rowId:'unknown',column:'amount',text:'1'}]),/UNKNOWN_CELL/);
});
test('F17 sorted range references stable row identities and measured summaries',()=>{
  const rows=[source.rows[3],source.rows[1],source.rows[0]];
  const range=rangeCells(rows,source.headers,{rowId:'r3',column:'amount'},{rowId:'r0',column:'group'});
  assert.deepEqual(range.map(r=>r[0].rowId),['r3','r1','r0']);
  assert.deepEqual(rangeStats(range),{count:5,missing:1,numeric:2,sum:5,mean:2.5});
  assert.deepEqual(rangeCells(rows,source.headers,{rowId:'r2',column:'amount'},{rowId:'r0',column:'group'}),[]);
});
test('F17 exports protect formula-like strings, including whitespace and control prefixes',()=>{
  assert.equal(delimitedExport([['=SUM(A1)',' +evil','\t@evil',-5,null,'a,b','"quoted"']]),
    '\'=SUM(A1),\' +evil,\'\t@evil,-5,,"a,b","""quoted"""');
});
test('F17 clipboard round trips trailing missing rows and quoted literal fields',()=>{
  assert.deepEqual(parseTSV(clipboardTSV([[1],[null],[null]])),[['1'],[''],['']]);
  assert.deepEqual(parseTSV(clipboardTSV([[null]])),[['']]);
  assert.deepEqual(parseTSV(clipboardTSV([['a\tb','c\nd'],[null,null]])),[['a\tb','c\nd'],['','']]);
});
test('F17 explicit commit produces fresh identity and provenance without copied pipeline artifacts',async()=>{
  const before=structuredClone(source);
  const next=applyCells(source,source,[{rowId:'r0',column:'amount',text:'2'}]);
  const version=await commitSheet({...source,preparation:{stale:true}},next);
  assert.equal(version.preparation,undefined);
  assert.equal(version.provenance.parentFingerprint,await sheetFingerprint(source));
  assert.notEqual(version.provenance.fingerprint,version.provenance.parentFingerprint);
  assert.equal(version.provenance.changedCells,1);
  assert.deepEqual(source,before);
  assert.deepEqual(version.rows.map(r=>r.id),source.rows.map(r=>r.id));
  await assert.rejects(commitSheet(source,source),/NO_CHANGES/);
  assert.throws(()=>validateWorkingCopy(source,{...source,rows:[...source.rows].reverse()}),/IDENTITY_MISMATCH/);
  assert.throws(()=>validateWorkingCopy(source,{...source,rows:source.rows.map(r=>({...r,amount:'bad'}))}),/INVALID_NUMBER/);
});

test('F17 edits outside selected features still invalidate F14 research comparability',async()=>{
  const original={headers:['x','y','unused','label'],rows:Array.from({length:40},(_,i)=>({id:'r'+i,x:i,y:i%7,unused:10,label:i%2}))};
  const current=applyCells(original,original,[{rowId:'r0',column:'unused',text:'11'}]);
  const version=await commitSheet(original,current);
  const recipe=defaultStudioRecipe(original);recipe.featureColumns=['x','y'];
  recipe.nodes=recipe.nodes.map(node=>({...node,columns:node.columns.filter(name=>name!=='unused')})).filter(node=>node.columns.length);
  const make=async dataset=>{
    const plan=executeStudioPipeline(dataset,recipe),matrix=createFeatureMatrix(plan);
    const model=fitWorkbenchModel(matrix,'baseline',{});
    return createRunReceipt({matrix,plan,candidate:{id:'baseline-candidate',algorithm:'baseline',model,options:{}},title:'F17 lineage check'});
  };
  const a=await make(original),b=await make(version);
  assert.notEqual(a.lineage.sourceDigest,b.lineage.sourceDigest);
  assert.notEqual(compareRunReceipts(a,b,'accuracy').status,'comparable');
});
