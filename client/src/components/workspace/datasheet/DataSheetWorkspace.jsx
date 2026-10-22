import { useEffect, useMemo, useRef, useState } from 'react';
import DataSheet from './DataSheet.jsx';
import { applyEdaFilters } from '../../../ml/edaFilters.js';
import { profileDataset } from '../../../ml/datasetProfiling.js';
import { applyCells, boundedSheet, clipboardTSV, commitSheet, delimitedExport, parseTSV, rangeCells, rangeStats, sheetChanges, validateWorkingCopy } from '../../../ml/datasheet/transactions.js';
import { datasetOwner, listDataSheets, saveDataSheet, deleteDataSheet } from '../../../services/datasetVersionRepository.js';

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DataSheetWorkspace({ dataset, filters, name, selectedRowId, onSelectRow, onInspectRow, onCommit, onAnalyze, onChart,highlightedRowIds=[],recovery = null }) {
  const owner = useRef(datasetOwner());
  const editorRef=useRef(null);
  const [history, setHistory] = useState([recovery?.current || { headers: dataset.headers, rows: dataset.rows }]);
  const [cursor, setCursor] = useState(0), [editing, setEditing] = useState(!!recovery);
  const [search, setSearch] = useState(''), [sorts, setSorts] = useState([]);
  const initialCell={rowId:selectedRowId||dataset.rows[0]?.id,column:dataset.headers[0]};
  const [anchor, setAnchor] = useState(initialCell), [end, setEnd] = useState(initialCell);
  const [selectionIds,setSelectionIds]=useState([initialCell]);
  const [draftInput,setDraftInput]=useState(null), [paste, setPaste] = useState('');
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const [review, setReview] = useState(false), [busy, setBusy] = useState(false);
  const [reviewPage,setReviewPage]=useState(0);
  const [record, setRecord] = useState(recovery), [saved, setSaved] = useState(null);
  const current = history[cursor];
  const input=draftInput?.snapshot===current&&draftInput?.rowId===end?.rowId&&draftInput?.column===end?.column
    ?draftInput.text:String(current.rows.find(r=>r.id===end?.rowId)?.[end?.column]??'');
  const view = useMemo(() => {
    let rows = applyEdaFilters(current, filters).rows;
    const query = search.toLowerCase();
    if (query) rows = rows.filter(row => current.headers.some(h => h.toLowerCase().includes(query) || String(row[h] ?? '').toLowerCase().includes(query)));
    rows = [...rows].sort((a, b) => {
      for (const sort of sorts) {
        const av = a[sort.column], bv = b[sort.column];
        if(av==null||bv==null){if(av==null&&bv==null)continue;return av==null?1:-1;}
        const n = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        if (n) return sort.direction === 'asc' ? n : -n;
      }
      return 0;
    });
    return { headers: current.headers, rows };
  }, [current, filters, search, sorts]);
  const cells = useMemo(() => {
    const keys=new Set(selectionIds.map(c=>JSON.stringify([c.rowId,c.column])));
    return view.rows.map(row=>view.headers.filter(column=>keys.has(JSON.stringify([row.id,column])))
      .map(column=>({rowId:row.id,column,value:row[column]}))).filter(row=>row.length);
  }, [view,selectionIds]);
  const stats = useMemo(() => rangeStats(cells), [cells]);
  const changes = useMemo(() => sheetChanges(dataset, current), [dataset, current]);
  const activeVisible=view.rows.some(r=>r.id===end?.rowId);
  const changePage=Math.min(reviewPage,Math.max(0,Math.ceil(changes.length/100)-1));
  const profile = useMemo(() => profileDataset(view), [view]);
  const column = profile.columns.find(c => c.name === end?.column);

  const run = async action => {
    setError('');
    try { if (owner.current !== datasetOwner()) throw new Error('IDENTITY_CHANGED: Reopen this dataset for the current account.'); return await action(); }
    catch (e) { setError(e.message); }
  };
  const transact = edits => run(() => {
    if (!editing) throw new Error('F17_READ_ONLY');
    if (busy) throw new Error('F17_SAVE_IN_PROGRESS: Wait for the local save to finish.');
    const next = applyCells(dataset, current, edits);
    setHistory(previous => [...previous.slice(Math.max(0, cursor - 49), cursor + 1), next]);
    setCursor(Math.min(cursor + 1, 50)); setStatus('Unsaved working copy');
  });
  const select = (cell, extend) => {
    if (!extend || !anchor) setAnchor(cell);
    setEnd(cell);
    setSelectionIds(rangeCells(view.rows,view.headers,extend&&anchor?anchor:cell,cell).flat().map(({rowId,column})=>({rowId,column})));
  };
  const pasteText = text => run(() => {
    if (!end) throw new Error('Select a starting cell first.');
    const matrix = parseTSV(text), r = view.rows.findIndex(row => row.id === end.rowId), c = view.headers.indexOf(end.column);
    if (r < 0 || c < 0 || r + matrix.length > view.rows.length || c + matrix[0].length > view.headers.length)
      throw new Error('F17_PASTE_OUT_OF_BOUNDS');
    return transact(matrix.flatMap((row, ri) => row.map((text, ci) => ({ rowId: view.rows[r + ri].id, column: view.headers[c + ci], text }))));
  });
  const copy = () => run(async () => {
    if (!cells.length) throw new Error('Select cells first.');
    await navigator.clipboard.writeText(clipboardTSV(cells.map(row => row.map(c => c.value))));
    setStatus('Selection copied as safe TSV');
  });
  const persist = async (version = null) => {
    const next = await saveDataSheet({ id: record?.id || crypto.randomUUID(), name, source: dataset, current,
      ...(version ? { version } : {}) }, record?.revision || 0, owner.current);
    if(owner.current!==datasetOwner())throw new Error('IDENTITY_CHANGED');
    setRecord(next); setSaved(current); setStatus(version ? 'Dataset version saved locally' : 'Draft saved locally');
    return next;
  };
  const commit = () => run(async () => {
    setBusy(true);
    try { const version = await commitSheet(dataset, current); await persist(version); onCommit(version, name + ' · edited version'); }
    finally { setBusy(false); }
  });
  useEffect(() => {
    const unload = event => { if (editing && changes.length && saved !== current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [editing, changes.length, saved, current]);

  return <div className="space-y-3" aria-label="DataSheet workspace">
    <div className="prism-scope-bar" aria-label="DataSheet context"><strong>{changes.length?'Working copy':'Original source view'}</strong><span>{view.rows.length} visible / {dataset.rows.length} source rows</span><span>{cells.length} selected rows</span><span>{changes.length} changed cells</span><span>{saved===current?'Draft saved in this browser':changes.length?'Draft changes need saving':'Source preserved'}</span></div>
    <div className="prism-sheet-tools">
      <label>Search values or columns<input aria-label="Search DataSheet" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button onClick={() => { setEditing(true); setStatus('Working copy · source preserved'); }} disabled={editing}>Create working copy</button>
      <button disabled={!cells.length} onClick={copy}>Copy selection</button>
      <button onClick={() => download('prism-filtered.csv', delimitedExport([view.headers, ...view.rows.map(row => view.headers.map(h => row[h]))]), 'text/csv')}>Export filtered CSV</button>
      <button disabled={!view.rows.length||changes.length>0} onClick={() => onAnalyze(view.rows.map(r => r.id), end?.column)}>Analyze visible rows / Chart</button>
      {onChart&&<><button disabled={!cells.length} onClick={()=>{
        const ids=new Set(cells.flat().map(c=>c.rowId)),columns=[...new Set(cells.flat().map(c=>c.column))];
        onChart({dataset:{headers:current.headers,rows:view.rows.filter(r=>ids.has(r.id))},sourceDataset:dataset,
          population:changes.length?'working_copy':'selection',columns,type:columns.length>1?'scatter':'histogram'});
      }}>Chart selected cells</button>
        <button disabled={!view.rows.length} onClick={()=>onChart({dataset:view,sourceDataset:dataset,population:changes.length?'working_copy':'filtered_source',columns:[end?.column||current.headers[0]],type:'histogram'})}>Chart current sheet view</button></>}
      <button onClick={() => { setSorts([]); setSearch(''); }}>Reset sheet view</button>
    </div>
    <p className="prism-sheet-muted">Click column names to sort; Shift-click adds another sort. Shift-click or Shift+arrows selects a range. {sorts.map(s => s.column + ' ' + s.direction).join(', ')}</p>
    {changes.length>0&&<p className="prism-sheet-muted">Draft charts are labeled Working copy. Commit edits before using them in F10 source analysis or F11 preparation.</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <p role="status" className="prism-sheet-muted">{status}</p>
    {highlightedRowIds.length>0&&<p role="status" className="prism-sheet-help">Linked chart highlights: {highlightedRowIds.length} original observations. View/search/filter operations preserve their source identities.</p>}
    <DataSheet dataset={view} sourceCount={dataset.rows.length} selectedRowId={selectedRowId} onSelectRow={onSelectRow} onInspectRow={onInspectRow} highlightedRowIds={highlightedRowIds}
      workingCopy={editing} selection={cells} onCellSelect={select} onCopy={copy}
      onEdit={()=>editorRef.current?.focus()}
      onHistory={direction=>{if(!busy){setCursor(Math.max(0,Math.min(history.length-1,cursor+(direction==='undo'?-1:1))));setStatus('Unsaved working copy');}}}
      onPaste={text => { if (editing) pasteText(text); }}
      onSort={(column, extend) => setSorts(previous => {
        const old = previous.find(s => s.column === column);
        const next = { column, direction: old?.direction === 'asc' ? 'desc' : 'asc' };
        return extend ? [...previous.filter(s => s.column !== column), next] : [next];
      })} />
    <div className="prism-sheet-tools" role="region" aria-label="Selected range statistics">
      <span>Count: {stats.count}</span><span>Missing: {stats.missing}</span><span>Numeric: {stats.numeric}</span>
      <span>Sum: {stats.sum}</span><span>Mean: {stats.mean ?? '—'}</span>
    </div>
    {column && <aside className="prism-sheet-help" aria-label="Column profile">
      <strong>{column.name} · {column.type}</strong> · Observed: {column.present} · Missing: {column.missing} · Unique: {column.unique}
      {column.type === 'numeric' && <> · Mean: {column.mean} · Median: {column.median} · Min: {column.min} · Max: {column.max}</>}
    </aside>}
    {editing && <section className="prism-sheet-edit space-y-3" aria-label="Working copy editor">
      <h5>Working copy · {changes.length} changed cells · original source preserved</h5>
      <div className="prism-sheet-tools">
        <label>Selected cell value<input ref={editorRef} disabled={!activeVisible||busy} aria-label="Edit cell value" value={activeVisible?input:''} onChange={e => setDraftInput({text:e.target.value,snapshot:current,...end})} onKeyDown={e=>{if(e.key==='Enter'&&activeVisible)transact([{...end,text:input}]);}} /></label>
        <button disabled={!activeVisible||busy} onClick={() => transact([{ ...end, text: input }])}>Apply cell</button>
        <button disabled={!cells.length} onClick={() => transact(cells.flat().map(c => ({ ...c, text: '' })))}>Clear selection</button>
        <button disabled={!cells.length} onClick={() => transact(cells.flatMap((row, ri) => ri ? row.map((c, ci) => ({ ...c, text: String(cells[0][ci].value ?? '') })) : []))}>Fill down</button>
        <button disabled={!cells.length} onClick={() => transact(cells.flatMap(row => row.slice(1).map(c => ({ ...c, text: String(row[0].value ?? '') }))))}>Fill right</button>
        <button disabled={busy||cursor === 0} onClick={() => { setCursor(cursor - 1); setStatus('Unsaved working copy'); }}>Undo</button>
        <button disabled={busy||cursor === history.length - 1} onClick={() => { setCursor(cursor + 1); setStatus('Unsaved working copy'); }}>Redo</button>
        <button disabled={busy} onClick={()=>{setHistory([{headers:dataset.headers,rows:dataset.rows}]);setCursor(0);setEditing(false);setStatus('Working copy discarded · Source restored');}}>Discard working copy</button>
      </div>
      <label>Paste rectangular TSV<textarea aria-label="Paste TSV" value={paste} onChange={e => setPaste(e.target.value)} /></label>
      <div className="prism-sheet-tools">
        <button disabled={!end} onClick={() => pasteText(paste)}>Apply paste</button>
        <button disabled={busy} onClick={() => run(async () => { setBusy(true); try { await persist(); } finally { setBusy(false); } })}>Save draft locally</button>
        <button onClick={() => download('prism-working-copy.json', JSON.stringify({ format: 'neuroforge-datasheet-v1', source: dataset, current }), 'application/json')}>Export working copy</button>
        <label>Import working copy<input disabled={busy} type="file" aria-label="Import working copy" accept=".json,application/json" onChange={e => {
          const file = e.target.files?.[0]; if (!file) return;
          run(async () => {
            if (file.size > 5 * 1024 * 1024) throw new Error('F17_IMPORT_TOO_LARGE');
            const data = JSON.parse(await file.text()); boundedSheet(data.source); boundedSheet(data.current);
            if (data.format !== 'neuroforge-datasheet-v1' || JSON.stringify(data.source) !== JSON.stringify(dataset) ||
              JSON.stringify(data.current.headers) !== JSON.stringify(dataset.headers) ||
              JSON.stringify(data.current.rows.map(r => r.id)) !== JSON.stringify(dataset.rows.map(r => r.id))) throw new Error('F17_IMPORT_SOURCE_MISMATCH');
            validateWorkingCopy(dataset,data.current);
            setHistory(previous=>[...previous.slice(Math.max(0,cursor-49),cursor+1),data.current]);
            setCursor(Math.min(cursor+1,50));setStatus('Imported working copy · Unsaved');
          });
        }} /></label>
        <button onClick={() => setReview(!review)} aria-expanded={review}>Review changes</button>
      </div>
      {review && <div className="prism-sheet-review" aria-label="Before and after changes">
        <table><thead><tr><th>Source ID</th><th>Column</th><th>Before</th><th>After</th></tr></thead>
          <tbody>{changes.slice(changePage*100,(changePage+1)*100).map(c => <tr key={JSON.stringify([c.rowId, c.column])}><td>{c.rowId}</td><td>{c.column}</td><td>{String(c.before ?? 'Missing')}</td><td>{String(c.after ?? 'Missing')}</td></tr>)}</tbody></table>
        <div className="prism-sheet-tools"><button disabled={changePage===0} onClick={()=>setReviewPage(changePage-1)}>Previous changes</button>
          <span>Change page {changePage+1} of {Math.max(1,Math.ceil(changes.length/100))} · {changes.length} changes</span>
          <button disabled={(changePage+1)*100>=changes.length} onClick={()=>setReviewPage(changePage+1)}>Next changes</button></div>
        <p>A new version restarts preparation. Existing fitted pipelines, evaluations and folds stay attached to their original data.</p>
        <button disabled={!changes.length || busy || !onCommit} onClick={commit}>Commit new dataset version</button>
      </div>}
    </section>}
  </div>;
}

export function DataSheetRecovery({ onRecover }) {
  const [records, setRecords] = useState([]), [error, setError] = useState('');
  const owner = useRef(datasetOwner());
  const refresh = () => listDataSheets(owner.current).then(setRecords).catch(e => setError(e.message));
  useEffect(() => { let active = true; listDataSheets(owner.current).then(r => { if (active) setRecords(r); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  return <section aria-label="Saved DataSheets" className="prism-sheet-tools">
    <button onClick={refresh}>Refresh saved DataSheets</button>
    <label>Import DataSheet bundle<input aria-label="Import DataSheet bundle" type="file" accept=".json,application/json" onChange={async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{
        if(owner.current!==datasetOwner())throw new Error('IDENTITY_CHANGED');
        if(file.size>5*1024*1024)throw new Error('F17_IMPORT_TOO_LARGE');
        const bundle=JSON.parse(await file.text());
        if(bundle.format!=='neuroforge-datasheet-v1')throw new Error('F17_INVALID_BUNDLE');
        validateWorkingCopy(bundle.source,bundle.current);
        onRecover({id:crypto.randomUUID(),name:file.name,source:bundle.source,current:bundle.current,revision:0});
      }catch(e){setError(e.message);}
    }}/></label>
    {error && <p role="alert">{error}</p>}
    {records.map(record => <div key={record.id}>
      <button onClick={() => { if (owner.current === datasetOwner()) onRecover(record); }}>{record.version ? 'Open version' : 'Recover draft'}: {record.name} · revision {record.revision}</button>
      {record.version&&<button onClick={()=>{if(owner.current===datasetOwner())onRecover({source:record.source,current:record.source,name:record.name+' · immutable parent source',id:crypto.randomUUID(),revision:0});}}>Open parent source: {record.name}</button>}
      <button aria-label={'Delete saved DataSheet ' + record.name} onClick={async () => { try { await deleteDataSheet(record.id, owner.current); await refresh(); } catch (e) { setError(e.message); } }}>Delete</button>
    </div>)}
  </section>;
}
