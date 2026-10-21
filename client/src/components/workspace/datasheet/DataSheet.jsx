import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Keyboard, LockKeyhole, Table2 } from 'lucide-react';
import {
  SHEET_DEFAULT_COLUMN_WIDTH,SHEET_HEADER_HEIGHT,SHEET_GUTTER_WIDTH,
  SHEET_MAX_COLUMN_WIDTH,SHEET_MIN_COLUMN_WIDTH,SHEET_ROW_HEIGHT,
  cellAddress,cellDisplay,columnKinds,columnLetter,gridViewport,
  moveSheetCell,normalizeColumnWidths,validateDataSheet,isSheetMissing,
} from '../../../ml/datasheet/gridModel.js';

const rowKey=row=>row.id;
const selectedStyle='prism-sheet-cell-active';
const gridCellId=(rowIndex,colIndex)=>'prism-cell-'+rowIndex+'-'+colIndex;

export default function DataSheet({dataset,selectedRowId=null,onSelectRow=()=>{},onInspectRow=()=>{}}){
  const safe=useMemo(()=>validateDataSheet(dataset),[dataset]);
  const headers=safe.headers,rows=safe.rows;
  const kinds=useMemo(()=>columnKinds(safe),[safe]);
  const [widths,setWidths]=useState(()=>
    normalizeColumnWidths(Array(headers.length).fill(SHEET_DEFAULT_COLUMN_WIDTH),headers.length));
  const fittedWidths=useMemo(()=>
    normalizeColumnWidths(widths,headers.length),[widths,headers.length]);
  const [position,setPosition]=useState({top:0,left:0,width:780,height:460});
  const [active,setActive]=useState(()=>({
    rowId:selectedRowId??rowKey(rows[0]??{id:''}),
    column:headers[0],
  }));
  const [helpOpen,setHelpOpen]=useState(false);
  const gridRef=useRef(null);
  const resizeRef=useRef(null);

  const rowIndexById=useMemo(()=>
    new Map(rows.map((row,index)=>[rowKey(row),index])),[rows]);
  const rowIndex=rowIndexById.get(active.rowId)??rowIndexById.get(selectedRowId)??0;
  const columnIndex=Math.max(0,headers.indexOf(active.column));
  const selectedRow=rows[rowIndex]??null;
  const selectedHeader=headers[columnIndex];
  const selectedValue=selectedRow?.[selectedHeader];

  const viewport=useMemo(()=>gridViewport({
    rowCount:rows.length,columnWidths:fittedWidths,
    scrollTop:position.top,scrollLeft:position.left,
    viewportHeight:position.height,viewportWidth:position.width,
  }),[rows.length,fittedWidths,position]);

  useEffect(()=>{
    const element=gridRef.current;
    if(!element)return;
    const measure=()=>{
      setPosition(previous=>{
        const width=Math.max(1,element.clientWidth),height=Math.max(1,element.clientHeight);
        return previous.width===width&&previous.height===height?previous:
          {...previous,width,height};
      });
    };
    if(typeof ResizeObserver!=='undefined'){
      const observer=new ResizeObserver(measure);
      observer.observe(element);
      return ()=>observer.disconnect();
    }
    queueMicrotask(measure);
  },[]);

  const focusCell=(nextRow,nextCol,{scroll=true}={})=>{
    if(!rows.length)return;
    const index=Math.max(0,Math.min(rows.length-1,nextRow));
    const col=Math.max(0,Math.min(headers.length-1,nextCol));
    const row=rows[index];
    setActive({rowId:rowKey(row),column:headers[col]});
    onSelectRow(rowKey(row));
    if(scroll&&gridRef.current){
      const node=gridRef.current;
      const cellTop=SHEET_HEADER_HEIGHT+index*SHEET_ROW_HEIGHT;
      const cellBottom=cellTop+SHEET_ROW_HEIGHT;
      const visibleTop=node.scrollTop+SHEET_HEADER_HEIGHT;
      const visibleBottom=node.scrollTop+node.clientHeight;
      if(cellTop<visibleTop)node.scrollTop=Math.max(0,cellTop-SHEET_HEADER_HEIGHT);
      else if(cellBottom>visibleBottom)node.scrollTop=cellBottom-node.clientHeight;
      const left=SHEET_GUTTER_WIDTH+
        fittedWidths.slice(0,col).reduce((sum,width)=>sum+width,0);
      const right=left+fittedWidths[col];
      if(left<node.scrollLeft+SHEET_GUTTER_WIDTH)
        node.scrollLeft=Math.max(0,left-SHEET_GUTTER_WIDTH);
      else if(right>node.scrollLeft+node.clientWidth)
        node.scrollLeft=right-node.clientWidth;
    }
  };
  const keyboard=event=>{
    if(event.altKey||event.target!==gridRef.current)return;
    const next=moveSheetCell({
      rowIndex,columnIndex,rowCount:rows.length,columnCount:headers.length,
      key:event.key,shiftKey:event.shiftKey,
      ctrlKey:event.ctrlKey,metaKey:event.metaKey,
      pageSize:Math.max(1,Math.floor((position.height-SHEET_HEADER_HEIGHT)/SHEET_ROW_HEIGHT)),
    });
    if(!next)return;
    event.preventDefault();
    focusCell(next.rowIndex,next.columnIndex);
  };

  const startResize=(event,index)=>{
    if(event.button!==0)return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current={index,startX:event.clientX,startWidth:fittedWidths[index],
      pointerId:event.pointerId};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resizeMove=event=>{
    const resize=resizeRef.current;
    if(!resize||resize.pointerId!==event.pointerId)return;
    const width=Math.max(SHEET_MIN_COLUMN_WIDTH,
      Math.min(SHEET_MAX_COLUMN_WIDTH,Math.round(resize.startWidth+event.clientX-resize.startX)));
    setWidths(previous=>{
      if(previous[resize.index]===width)return previous;
      const next=normalizeColumnWidths(previous,headers.length);
      next[resize.index]=width;
      return next;
    });
  };
  const endResize=event=>{
    if(resizeRef.current?.pointerId!==event.pointerId)return;
    resizeRef.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyboardResize=(event,index)=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();
    event.stopPropagation();
    setWidths(previous=>{
      const result=normalizeColumnWidths(previous,headers.length);
      const delta=(event.shiftKey?25:10)*(event.key==='ArrowRight'?1:-1);
      result[index]=Math.max(SHEET_MIN_COLUMN_WIDTH,
        Math.min(SHEET_MAX_COLUMN_WIDTH,result[index]+delta));
      return result;
    });
  };

  const activeCellVisible=selectedRow&&
    rowIndex>=viewport.rowStart&&rowIndex<viewport.rowEnd&&
    columnIndex>=viewport.colStart&&columnIndex<viewport.colEnd;

  return <section aria-label="F17 PRISM DataSheet" className="prism-sheet-shell">
    <div className="prism-sheet-toolbar">
      <div className="flex min-w-0 items-center gap-3">
        <div className="prism-sheet-icon"><Table2 size={20} aria-hidden="true"/></div>
        <div className="min-w-0">
          <p className="prism-eyebrow">PRISM / DATA WORKSPACE</p>
          <h5 className="prism-sheet-title">DataSheet</h5>
          <p className="prism-sheet-muted">{rows.length.toLocaleString()} filtered observations · {headers.length} original columns</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="prism-status-pill"><LockKeyhole size={13} aria-hidden="true"/> Source · Read-only</span>
        <button type="button" className="prism-sheet-action" onClick={()=>setHelpOpen(value=>!value)}
          aria-expanded={helpOpen} aria-controls="prism-sheet-help">
          <Keyboard size={14} aria-hidden="true"/> Keyboard
        </button>
      </div>
    </div>
    {helpOpen&&<div id="prism-sheet-help" className="prism-sheet-help" role="note">
      Focus the grid, then use Arrow keys to move between cells. Home/End move across a row,
      Ctrl/Command+Home and Ctrl/Command+End jump to the first/last cell,
      PageUp/PageDown jump through rows, and Tab/Shift+Tab move across cells.
      Column separators are draggable or can be resized with Left/Right when focused. F17.0 does not change source values.
    </div>}
    <div className="prism-sheet-formula" aria-label="Selected source cell">
      <div className="prism-sheet-address" aria-label="Selected cell address">
        {selectedRow?cellAddress(rowIndex,columnIndex):'—'}
      </div>
      <div className="prism-sheet-formula-fx" aria-hidden="true">fx</div>
      <div className="prism-sheet-value" title={selectedRow?cellDisplay(selectedValue):''}>
        {selectedRow?cellDisplay(selectedValue):'No matching source rows'}
      </div>
      <div className="prism-sheet-data-kind">{kinds[columnIndex]?.kind??'unknown'}</div>
    </div>
    <div className="prism-sheet-container">
      <div ref={gridRef} role="grid" tabIndex={0}
        aria-label="PRISM DataSheet cells" aria-readonly="true"
        aria-rowcount={rows.length+1} aria-colcount={headers.length+1}
        aria-activedescendant={activeCellVisible?gridCellId(rowIndex,columnIndex):undefined}
        onScroll={event=>{
          const element=event.currentTarget;
          setPosition(previous=>previous.top===element.scrollTop&&previous.left===element.scrollLeft?
            previous:{...previous,top:element.scrollTop,left:element.scrollLeft});
        }}
        onKeyDown={keyboard}
        className="prism-sheet-viewport">
        <div className="prism-sheet-plane" style={{
          width:viewport.totalWidth,height:viewport.totalHeight,
        }}>
          <div role="row" aria-rowindex={1} className="prism-sheet-header" style={{
            height:SHEET_HEADER_HEIGHT,width:viewport.totalWidth,
          }}>
            <div role="columnheader" aria-colindex={1} className="prism-sheet-corner"
              style={{width:SHEET_GUTTER_WIDTH,height:SHEET_HEADER_HEIGHT}}>
              <span aria-hidden="true">#</span>
            </div>
            {headers.slice(viewport.colStart,viewport.colEnd).map((name,offset)=>{
              const index=viewport.colStart+offset;
              return <div key={name} role="columnheader" aria-colindex={index+2}
                className="prism-sheet-column" style={{
                  left:viewport.offsets[index],width:fittedWidths[index],
                  height:SHEET_HEADER_HEIGHT,
                }}>
                <div className="prism-sheet-column-letter">{columnLetter(index)}</div>
                <div className="prism-sheet-column-name" title={name}>{name}</div>
                <span className="prism-sheet-column-type">{kinds[index].kind}</span>
                <button type="button" className="prism-sheet-resize"
                  aria-label={'Resize DataSheet column '+name}
                  title={'Drag or use Left/Right arrow keys to resize '+name}
                  onKeyDown={event=>keyboardResize(event,index)}
                  onPointerDown={event=>startResize(event,index)}
                  onPointerMove={resizeMove}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}/>
              </div>;
            })}
          </div>
          {rows.slice(viewport.rowStart,viewport.rowEnd).map((row,offset)=>{
            const index=viewport.rowStart+offset;
            const rowIsActive=rowIndex===index;
            return <div role="row" aria-rowindex={index+2} key={rowKey(row)}
              className={'prism-sheet-row '+(rowIsActive?'prism-sheet-row-current':'')}
              style={{
                top:SHEET_HEADER_HEIGHT+index*SHEET_ROW_HEIGHT,
                height:SHEET_ROW_HEIGHT,width:viewport.totalWidth,
              }}>
              <div role="rowheader" aria-colindex={1}
                className="prism-sheet-row-number" style={{
                  width:SHEET_GUTTER_WIDTH,height:SHEET_ROW_HEIGHT,
                }} title={'Source row '+rowKey(row)}>
                {index+1}
              </div>
              {headers.slice(viewport.colStart,viewport.colEnd).map((name,colOffset)=>{
                const col=viewport.colStart+colOffset;
                const selected=rowIsActive&&col===columnIndex;
                return <div key={name} role="gridcell" id={gridCellId(index,col)}
                  aria-colindex={col+2} aria-selected={selected}
                  aria-label={cellAddress(index,col)+', '+name+', '+cellDisplay(row[name])}
                  title={cellDisplay(row[name])}
                  onClick={()=>{focusCell(index,col,{scroll:false});gridRef.current?.focus();}}
                  className={'prism-sheet-cell '+(selected?selectedStyle:'')+
                    (isSheetMissing(row[name])?' prism-sheet-cell-missing':'')}
                  style={{left:viewport.offsets[col],width:fittedWidths[col],
                    height:SHEET_ROW_HEIGHT}}>
                  <span className="prism-sheet-cell-text">{cellDisplay(row[name])}</span>
                </div>;
              })}
            </div>;
          })}
        </div>
      </div>
      {rows.length===0&&<div className="prism-sheet-empty" role="status">
        No rows match the current F10 filters. Clear or adjust filters to view source cells.
      </div>}
    </div>
    <div role="region" className="prism-sheet-inspector" aria-label="DataSheet source inspector">
      <div className="min-w-0">
        <p className="prism-eyebrow">ORIGINAL OBSERVATION</p>
        <p className="prism-sheet-muted" role="status">
          {selectedRow
            ?<>{cellAddress(rowIndex,columnIndex)} · {selectedHeader} · source ID: {rowKey(selectedRow)}</>
            :'No active source observation'}
        </p>
      </div>
      <button type="button" className="prism-sheet-action" disabled={!selectedRow}
        onClick={()=>{if(selectedRow)onInspectRow(rowKey(selectedRow));}}>
        Inspect in Row Explorer <ArrowUpRight size={14} aria-hidden="true"/>
      </button>
    </div>
    <footer className="prism-sheet-footer">
      <span>{rows.length.toLocaleString()} visible of {rows.length.toLocaleString()} filtered observations</span>
      <span>Mounted: {viewport.mountedRowCount} rows × {viewport.mountedColumnCount} columns</span>
      <span>Read-only · No dataset mutation</span>
    </footer>
  </section>;
}
