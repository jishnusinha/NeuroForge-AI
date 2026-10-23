/**
 * F17.0 read-only PRISM DataSheet domain contract.
 *
 * Source row IDs are immutable identities, not visible grid coordinates.
 * Viewport calculations render only on-screen rows/columns (+ bounded overscan).
 * This module never mutates a dataset and never evaluates cell contents.
 */
export const SHEET_MAX_ROWS=2000;
export const SHEET_MAX_COLUMNS=100;
export const SHEET_ROW_HEIGHT=40;
export const SHEET_HEADER_HEIGHT=64;
export const SHEET_GUTTER_WIDTH=72;
export const SHEET_MIN_COLUMN_WIDTH=110;
export const SHEET_MAX_COLUMN_WIDTH=360;
export const SHEET_DEFAULT_COLUMN_WIDTH=180;

const clamp=(n,low,high)=>Math.min(high,Math.max(low,n));
export const isSheetMissing=value=>value===null||value===undefined||
  value===''||(typeof value==='number'&&!Number.isFinite(value));

export function validateDataSheet(dataset) {
  if(!dataset||!Array.isArray(dataset.headers)||!Array.isArray(dataset.rows)||
     dataset.headers.length<1||dataset.headers.length>SHEET_MAX_COLUMNS||
     dataset.rows.length>SHEET_MAX_ROWS||
     dataset.headers.some(name=>typeof name!=='string'||!name||
       ['id','__proto__','constructor','prototype'].includes(name))||
     new Set(dataset.headers).size!==dataset.headers.length)
    throw new Error('F17_INVALID_SHEET_SCHEMA');
  const ids=new Set();
  for(const row of dataset.rows){
    if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id))
      throw new Error('F17_INVALID_ROW_IDENTITY');
    ids.add(row.id);
    for(const name of dataset.headers){
      const value=row[name];
      if(value!==null&&value!==undefined&&typeof value!=='string'&&
         !(typeof value==='number'&&Number.isFinite(value)))
        throw new Error('F17_INVALID_SOURCE_CELL');
    }
  }
  return dataset;
}

export function columnLetter(index){
  if(!Number.isInteger(index)||index<0||index>=SHEET_MAX_COLUMNS)
    throw new Error('F17_COLUMN_INDEX');
  let n=index+1,result='';
  while(n){n--;result=String.fromCharCode(65+n%26)+result;n=Math.floor(n/26);}
  return result;
}

export function cellAddress(rowIndex,columnIndex){
  if(!Number.isInteger(rowIndex)||rowIndex<0||rowIndex>=SHEET_MAX_ROWS)
    throw new Error('F17_ROW_INDEX');
  return columnLetter(columnIndex)+(rowIndex+1);
}

export function columnKinds(dataset){
  validateDataSheet(dataset);
  return dataset.headers.map(name=>{
    let numbers=0,strings=0,missing=0;
    for(const row of dataset.rows){
      const value=row[name];
      if(isSheetMissing(value))missing++;
      else if(typeof value==='number')numbers++;
      else strings++;
    }
    const kind=numbers&&strings?'mixed':numbers?'numeric':strings?'categorical':'empty';
    return {name,kind,numbers,strings,missing};
  });
}

export function cellDisplay(value){
  return isSheetMissing(value)?'Missing':String(value);
}

export function normalizeColumnWidths(widths,count){
  if(!Number.isInteger(count)||count<1||count>SHEET_MAX_COLUMNS)
    throw new Error('F17_COLUMN_COUNT');
  return Array.from({length:count},(_,index)=>{
    const width=widths?.[index];
    return typeof width==='number'&&Number.isFinite(width)?
      clamp(Math.round(width),SHEET_MIN_COLUMN_WIDTH,SHEET_MAX_COLUMN_WIDTH):
      SHEET_DEFAULT_COLUMN_WIDTH;
  });
}

/** Pure geometric visibility, suitable for synthetic 2000 x 20 verification. */
export function gridViewport({
  rowCount,columnWidths,scrollTop=0,scrollLeft=0,
  viewportHeight=480,viewportWidth=760,overscanRows=3,overscanColumns=1,
}){
  if(!Number.isInteger(rowCount)||rowCount<0||rowCount>SHEET_MAX_ROWS||
     !Array.isArray(columnWidths)||columnWidths.length<1||
     columnWidths.length>SHEET_MAX_COLUMNS||
     columnWidths.some(width=>!Number.isFinite(width)||width<SHEET_MIN_COLUMN_WIDTH||
       width>SHEET_MAX_COLUMN_WIDTH)||
     ![scrollTop,scrollLeft,viewportHeight,viewportWidth].every(Number.isFinite)||
     scrollTop<0||scrollLeft<0||viewportHeight<=0||viewportWidth<=0)
    throw new Error('F17_INVALID_VIEWPORT');
  const offsets=[];
  let x=SHEET_GUTTER_WIDTH;
  for(const width of columnWidths){offsets.push(x);x+=width;}
  const totalWidth=x;
  const totalHeight=SHEET_HEADER_HEIGHT+rowCount*SHEET_ROW_HEIGHT;
  const rowStart=clamp(
    Math.floor(Math.max(0,scrollTop-SHEET_HEADER_HEIGHT)/SHEET_ROW_HEIGHT)-overscanRows,0,rowCount);
  const rowEnd=clamp(
    Math.ceil(Math.max(0,scrollTop+viewportHeight-SHEET_HEADER_HEIGHT)/SHEET_ROW_HEIGHT)+overscanRows,
    rowStart,rowCount);
  const left=scrollLeft+SHEET_GUTTER_WIDTH;
  const right=scrollLeft+viewportWidth;
  let first=columnWidths.findIndex((width,index)=>offsets[index]+width>left);
  if(first<0)first=columnWidths.length-1;
  let last=columnWidths.findIndex((width,index)=>offsets[index]>=right);
  if(last<0)last=columnWidths.length;
  const colStart=clamp(first-overscanColumns,0,columnWidths.length);
  const colEnd=clamp(last+overscanColumns,colStart,columnWidths.length);
  return {rowStart,rowEnd,colStart,colEnd,offsets,totalWidth,totalHeight,
    mountedRowCount:rowEnd-rowStart,mountedColumnCount:colEnd-colStart};
}

/**
 * Keyboard navigation is based on VISIBLE row positions, but selection
 * is always stored by its source row ID and column name.
 */
export function moveSheetCell({rowIndex,columnIndex,rowCount,columnCount,key,
  shiftKey=false,ctrlKey=false,metaKey=false,pageSize=10}){
  if(!Number.isInteger(rowCount)||!Number.isInteger(columnCount)||rowCount<1||
     columnCount<1||columnCount>SHEET_MAX_COLUMNS) return null;
  let row=clamp(rowIndex,0,rowCount-1);
  let col=clamp(columnIndex,0,columnCount-1);
  const ctrl=ctrlKey||metaKey;
  switch(key){
    case 'ArrowRight': col++;break;
    case 'ArrowLeft': col--;break;
    case 'ArrowDown': row++;break;
    case 'ArrowUp': row--;break;
    case 'Home':
      if(ctrl)row=0;
      col=0;break;
    case 'End':
      if(ctrl)row=rowCount-1;
      col=columnCount-1;break;
    case 'PageDown':row+=Math.max(1,Math.floor(pageSize));break;
    case 'PageUp':row-=Math.max(1,Math.floor(pageSize));break;
    case 'Tab':
      if(shiftKey){col--;if(col<0){col=columnCount-1;row--;}}
      else{col++;if(col>=columnCount){col=0;row++;}}
      break;
    case 'Enter':row+=shiftKey?-1:1;break;
    default:return null;
  }
  return {rowIndex:clamp(row,0,rowCount-1),
    columnIndex:clamp(col,0,columnCount-1)};
}
