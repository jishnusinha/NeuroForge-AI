import { useEffect, useMemo, useState } from 'react';
import { isMissingValue, sortEdaRows } from '../../../ml/edaFilters.js';
const PER_PAGE = 25;

export default function EdaRowExplorer({ dataset, selectedRowId, onSelectRow }) {
  const [column, setColumn] = useState(dataset.headers[0] ?? '');
  const [direction, setDirection] = useState('asc');
  const [page, setPage] = useState(0);
  const sorted = useMemo(()=>sortEdaRows(dataset.rows,column,direction),[dataset.rows,column,direction]);
  const selectedIndex = sorted.findIndex((row,index)=>String(row.id??'row-'+(index+1))===selectedRowId);
  useEffect(()=>{if(selectedIndex>=0)setPage(Math.floor(selectedIndex/PER_PAGE));},[selectedIndex]);
  const pageCount = Math.max(1,Math.ceil(sorted.length/PER_PAGE));
  const current = Math.min(page,pageCount-1);
  const visible = sorted.slice(current*PER_PAGE,(current+1)*PER_PAGE);
  return <section aria-label="Row explorer" className="space-y-3">
    <div className="flex flex-wrap justify-between gap-2">
      <p role="status" className="text-sm text-text-muted">{dataset.rows.length} included records · Page {current+1} of {pageCount} · Source values only</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">Sort by
          <select aria-label="Sort row column" className="ml-2 min-h-10 rounded-lg border border-white/15 bg-obsidian px-2 text-text-primary"
            value={column} onChange={event=>{setColumn(event.target.value);setPage(0);}}>
            {dataset.headers.map(name=><option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs">Direction
          <select aria-label="Sort direction" className="ml-2 min-h-10 rounded-lg border border-white/15 bg-obsidian px-2 text-text-primary"
            value={direction} onChange={event=>{setDirection(event.target.value);setPage(0);}}>
            <option value="asc">Ascending</option><option value="desc">Descending</option>
          </select>
        </label>
      </div>
    </div>
    <div role="region" aria-label="Filtered source row table" tabIndex={0} className="max-h-[520px] overflow-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[500px] text-left text-xs">
        <caption className="p-3 text-left text-text-muted">Up to {PER_PAGE} observations per page. Select a row to inspect its original values.</caption>
        <thead className="sticky top-0 bg-surface-elevated"><tr><th scope="col" className="p-2">Row ID</th>{dataset.headers.map(name=><th scope="col" key={name} className="p-2">{name}</th>)}</tr></thead>
        <tbody>{visible.map((row,index)=>{
          const id=String(row.id??'row-'+(current*PER_PAGE+index+1));
          return <tr key={id} className={'border-t border-white/10 '+(id===selectedRowId?'bg-plasma-cyan/15':'')}>
            <th scope="row" className="p-2"><button type="button" aria-label={'Inspect source row '+id} onClick={()=>onSelectRow(id)} className="text-plasma-cyan underline">{id}</button></th>
            {dataset.headers.map(name=><td key={name} className="p-2 break-all">
              {isMissingValue(row[name])?<span className="text-signal-amber">Missing</span>:String(row[name])}
            </td>)}
          </tr>;
        })}</tbody>
      </table>
    </div>
    {sorted.length===0 && <p role="status" className="text-sm text-text-muted">No observations match the current filters. Remove a filter to inspect rows.</p>}
    <div className="flex items-center justify-between">
      <button type="button" disabled={current===0} onClick={()=>setPage(x=>Math.max(0,x-1))} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-40">Previous page</button>
      <span className="text-xs text-text-muted">Page {current+1} / {pageCount}</span>
      <button type="button" disabled={current>=pageCount-1} onClick={()=>setPage(x=>Math.min(pageCount-1,x+1))} className="rounded-lg border border-white/15 px-3 py-2 text-xs disabled:opacity-40">Next page</button>
    </div>
    {selectedRowId && <p role="status" className="text-sm text-text-muted">Selected original row: {selectedRowId}</p>}
  </section>;
}
