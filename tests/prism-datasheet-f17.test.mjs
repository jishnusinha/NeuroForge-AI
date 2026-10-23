import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAndValidateCSV } from '../client/src/ml/datasetImport.js';
import { applyEdaFilters } from '../client/src/ml/edaFilters.js';
import {
  SHEET_MAX_ROWS,SHEET_MAX_COLUMNS,SHEET_ROW_HEIGHT,SHEET_HEADER_HEIGHT,
  SHEET_GUTTER_WIDTH,SHEET_MIN_COLUMN_WIDTH,SHEET_MAX_COLUMN_WIDTH,
  validateDataSheet,columnLetter,cellAddress,columnKinds,cellDisplay,
  normalizeColumnWidths,gridViewport,moveSheetCell,
} from '../client/src/ml/datasheet/gridModel.js';

const fixture=parseAndValidateCSV(
  'age,spend,label\n25,100,0\n30,150,1\n,200,1\n50,300,0\n60,400,1\n',
  {requiredNumericCols:0});
const fullData=()=>{
  const headers=Array.from({length:SHEET_MAX_COLUMNS},(_,i)=>'measure_'+i);
  const rows=Array.from({length:SHEET_MAX_ROWS},(_,i)=>({
    id:'source-row-'+i,...Object.fromEntries(headers.map((name,j)=>[name,i*100+j])),
  }));
  return {headers,rows};
};

test('F17.0 source schema preserves imported stable IDs, types and missing cell values',()=>{
  const before=structuredClone(fixture);
  assert.equal(validateDataSheet(fixture),fixture);
  assert.deepEqual(columnKinds(fixture),[
    {name:'age',kind:'numeric',numbers:4,strings:0,missing:1},
    {name:'spend',kind:'numeric',numbers:5,strings:0,missing:0},
    {name:'label',kind:'numeric',numbers:5,strings:0,missing:0},
  ]);
  assert.equal(cellDisplay(null),'Missing');
  assert.equal(cellDisplay(0),'0');
  assert.equal(cellDisplay('=not-executed'),'=not-executed');
  assert.equal(cellDisplay(-10.85),'-10.85');
  assert.deepEqual(fixture,before);
});

test('F17.0 Excel-style addresses and source row position are unambiguous',()=>{
  assert.equal(columnLetter(0),'A');
  assert.equal(columnLetter(19),'T');
  assert.equal(cellAddress(0,0),'A1');
  assert.equal(cellAddress(1999,99),'CV2000');
  assert.throws(()=>columnLetter(100),/F17_COLUMN_INDEX/);
  assert.throws(()=>cellAddress(2000,0),/F17_ROW_INDEX/);
});

test('F17.0 bounded 2000x100 data is valid, but the viewport renders a bounded subset',()=>{
  const data=fullData();
  const before=structuredClone(data.rows[1999]);
  assert.equal(validateDataSheet(data),data);
  const widths=normalizeColumnWidths([],data.headers.length);
  assert.equal(widths.length,100);
  const initial=gridViewport({
    rowCount:data.rows.length,columnWidths:widths,
    scrollTop:0,scrollLeft:0,viewportHeight:480,viewportWidth:760,
  });
  assert.equal(initial.rowStart,0);
  assert.ok(initial.mountedRowCount<30);
  assert.ok(initial.mountedColumnCount<8);
  assert.equal(initial.totalHeight,SHEET_HEADER_HEIGHT+2000*SHEET_ROW_HEIGHT);
  assert.equal(initial.totalWidth,SHEET_GUTTER_WIDTH+100*180);
  const nearEnd=gridViewport({
    rowCount:2000,columnWidths:widths,
    scrollTop:SHEET_HEADER_HEIGHT+1995*SHEET_ROW_HEIGHT,
    scrollLeft:SHEET_GUTTER_WIDTH+17*180,viewportHeight:480,viewportWidth:400,
  });
  assert.ok(nearEnd.rowStart>=1990);
  assert.equal(nearEnd.rowEnd,2000);
  assert.ok(nearEnd.colStart>=15);
  assert.equal(nearEnd.colEnd,21);
  assert.ok(nearEnd.mountedRowCount<30);
  assert.deepEqual(data.rows[1999],before);
});

test('F17.0 keyboard navigation respects sheet boundaries, wrapping and paging',()=>{
  const args={rowIndex:0,columnIndex:0,rowCount:2000,columnCount:100};
  assert.deepEqual(moveSheetCell({...args,key:'ArrowLeft'}),{rowIndex:0,columnIndex:0});
  assert.deepEqual(moveSheetCell({...args,key:'ArrowDown'}),{rowIndex:1,columnIndex:0});
  assert.deepEqual(moveSheetCell({...args,key:'ArrowRight'}),{rowIndex:0,columnIndex:1});
  assert.deepEqual(moveSheetCell({...args,key:'End'}),{rowIndex:0,columnIndex:99});
  assert.deepEqual(moveSheetCell({...args,key:'End',ctrlKey:true}),{rowIndex:1999,columnIndex:99});
  assert.deepEqual(moveSheetCell({...args,key:'Home',metaKey:true,rowIndex:400,columnIndex:8}),
    {rowIndex:0,columnIndex:0});
  assert.deepEqual(moveSheetCell({...args,key:'Tab',rowIndex:1,columnIndex:99}),
    {rowIndex:2,columnIndex:0});
  assert.deepEqual(moveSheetCell({...args,key:'Tab',shiftKey:true,rowIndex:3,columnIndex:0}),
    {rowIndex:2,columnIndex:99});
  assert.deepEqual(moveSheetCell({...args,key:'PageDown',pageSize:13}),
    {rowIndex:13,columnIndex:0});
  assert.deepEqual(moveSheetCell({...args,key:'Enter',shiftKey:true}),
    {rowIndex:0,columnIndex:0});
  assert.equal(moveSheetCell({...args,key:'Backspace'}),null);
  assert.equal(moveSheetCell({...args,rowCount:0,key:'ArrowDown'}),null);
});

test('F17.0 column resizing is capped and the viewport recomputes exact offsets',()=>{
  assert.deepEqual(normalizeColumnWidths([65,170,999],3),
    [SHEET_MIN_COLUMN_WIDTH,170,SHEET_MAX_COLUMN_WIDTH]);
  const widths=[110,220,360];
  const view=gridViewport({rowCount:20,columnWidths:widths,viewportWidth:280,viewportHeight:340});
  assert.deepEqual(view.offsets,[SHEET_GUTTER_WIDTH,SHEET_GUTTER_WIDTH+110,SHEET_GUTTER_WIDTH+330]);
  assert.equal(view.totalWidth,SHEET_GUTTER_WIDTH+690);
  assert.throws(()=>gridViewport({rowCount:2001,columnWidths:widths}),/F17_INVALID_VIEWPORT/);
  assert.throws(()=>gridViewport({rowCount:20,columnWidths:[99]}),/F17_INVALID_VIEWPORT/);
});

test('F17.0 parent F10 filter defines the visible source set and does not mutate rows',()=>{
  const before=structuredClone(fixture);
  const filtered=applyEdaFilters(fixture,[{id:'only-one',column:'label',operator:'equals',value:'1'}]);
  assert.equal(filtered.visibleCount,3);
  assert.deepEqual(filtered.rows.map(row=>row.id),['sample-1','sample-2','sample-4']);
  const scope={headers:fixture.headers,rows:filtered.rows};
  assert.equal(validateDataSheet(scope),scope);
  assert.equal(cellDisplay(scope.rows[1].age),'Missing');
  assert.deepEqual(fixture,before);
});

test('F17.0 rejects duplicate IDs, missing IDs, unsafe header names and invalid values',()=>{
  const badBase={headers:['measure'],rows:[{id:'r1',measure:1},{id:'r1',measure:2}]};
  assert.throws(()=>validateDataSheet(badBase),/F17_INVALID_ROW_IDENTITY/);
  assert.throws(()=>validateDataSheet({headers:['measure'],rows:[{measure:1}]}),/F17_INVALID_ROW_IDENTITY/);
  assert.throws(()=>validateDataSheet({headers:['__proto__'],rows:[{id:'r1'}]}),/F17_INVALID_SHEET_SCHEMA/);
  assert.throws(()=>validateDataSheet({headers:['measure'],rows:[{id:'r1',measure:Infinity}]}),/F17_INVALID_SOURCE_CELL/);
  assert.throws(()=>validateDataSheet({headers:['measure'],rows:[{id:'r1',measure:{x:1}}]}),/F17_INVALID_SOURCE_CELL/);
  assert.throws(()=>validateDataSheet({headers:['a','a'],rows:[]}),/F17_INVALID_SHEET_SCHEMA/);
  assert.throws(()=>validateDataSheet({headers:['a'],rows:Array.from({length:2001},(_,i)=>({id:'r'+i,a:i}))}),/F17_INVALID_SHEET_SCHEMA/);
});
