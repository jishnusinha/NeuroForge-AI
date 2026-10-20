import { useMemo, useState } from 'react';
import { profileDataset } from '../../../ml/datasetProfiling.js';
import { correlationEvidence } from '../../../ml/edaStatistics.js';

export default function EdaCorrelationView({ dataset, onInspectRow }) {
  const report = useMemo(() => profileDataset(dataset), [dataset]);
  const numeric = report.columns.filter(column=>column.type==='numeric').map(column=>column.name);
  const [columns, setColumns] = useState(numeric.slice(0,8));
  const [method, setMethod] = useState('pearson');
  const [focused, setFocused] = useState(null);
  const selected = columns.filter(column=>numeric.includes(column)).slice(0,12);
  const evidence = correlationEvidence(dataset, selected, method);
  const pair = focused && evidence.matrix.find((row)=>row[0]?.x===focused.x)?.find(cell=>cell.y===focused.y);
  const matchingRows = focused ? dataset.rows.filter(row=>Number.isFinite(row[focused.x]) && Number.isFinite(row[focused.y])) : [];
  return <section aria-label="Correlation laboratory" className="space-y-3">
    <p className="text-sm text-text-muted">Correlations are pairwise-complete descriptive associations, never proof of causality. Each cell shows its valid paired sample count and unavailable coefficients remain N/A.</p>
    <label className="block max-w-xs text-sm">Method
      <select aria-label="Correlation method" value={method} onChange={event=>{setMethod(event.target.value);setFocused(null);}}
        className="mt-1 block min-h-10 w-full rounded-lg bg-obsidian border border-white/20 p-2 text-text-primary">
        <option value="pearson">Pearson (linear relationship)</option>
        <option value="spearman">Spearman (rank relationship; ties averaged)</option>
      </select>
    </label>
    <fieldset className="rounded-lg border border-white/10 p-3">
      <legend className="text-xs font-semibold">Numeric columns (select 2–12)</legend>
      <div className="flex flex-wrap gap-3">
        {numeric.map(name=><label key={name} className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={selected.includes(name)}
            onChange={event=>{setColumns(previous=>event.target.checked ? [...previous,name].slice(0,12) : previous.filter(item=>item!==name));setFocused(null);}}
            disabled={!selected.includes(name)&&selected.length>=12}/>
          {name}
        </label>)}
      </div>
    </fieldset>
    {selected.length<2 ? <p role="status" className="p-4 rounded-lg bg-obsidian">Select at least two numeric columns.</p>
      : <div role="region" aria-label="Correlation matrix" tabIndex={0} className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[460px] text-center text-xs">
          <caption className="p-3 text-left text-text-muted">{method==='pearson'?'Pearson r':'Spearman rho'} with actual paired observation counts. Choose a cell to inspect evidence.</caption>
          <thead className="bg-surface-elevated"><tr><th scope="col" className="p-2">Feature</th>{selected.map(name=><th scope="col" key={name} className="p-2">{name}</th>)}</tr></thead>
          <tbody>{evidence.matrix.map((row,index)=><tr key={selected[index]} className="border-t border-white/10">
            <th scope="row" className="p-2 text-left">{selected[index]}</th>
            {row.map(cell=><td key={cell.y} className="p-1">
              <button type="button" onClick={()=>setFocused({x:cell.x,y:cell.y})}
                aria-label={'Inspect correlation '+cell.x+' and '+cell.y}
                className={'w-full rounded-lg p-2 hover:outline hover:outline-1 hover:outline-plasma-cyan '+
                  (cell.r===null?'bg-obsidian text-text-muted':cell.r>=0?'bg-plasma-cyan/15 text-text-primary':'bg-neural-violet/15 text-text-primary')}>
                <span className="block font-semibold tabular-nums">{cell.r===null?'N/A':cell.r.toFixed(3)}</span>
                <span className="text-[10px] text-text-muted">n={cell.count}</span>
              </button>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div>}
    {pair && <div role="region" aria-label="Correlation pair evidence" className="space-y-2 rounded-xl border border-white/10 bg-obsidian p-3">
      <h5 className="font-semibold">{pair.x} versus {pair.y}</h5>
      <p className="text-sm text-text-muted">{pair.status==='ok'
        ? method+' coefficient '+pair.r.toFixed(4)+' from '+pair.count+' complete pairs'
        : 'Coefficient unavailable: too few complete pairs or zero variation.'}</p>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-xs">
          <caption className="text-left text-text-muted">First {Math.min(20,matchingRows.length)} of {matchingRows.length} eligible original observations.</caption>
          <thead><tr><th className="p-2" scope="col">Row</th><th className="p-2" scope="col">{pair.x}</th><th className="p-2" scope="col">{pair.y}</th></tr></thead>
          <tbody>{matchingRows.slice(0,20).map((row,index)=><tr key={row.id??index} className="border-t border-white/10">
            <td className="p-2"><button type="button" className="underline text-plasma-cyan" onClick={()=>onInspectRow(String(row.id??'row-'+(index+1)))}>{row.id??index+1}</button></td>
            <td className="p-2 tabular-nums">{row[pair.x]}</td><td className="p-2 tabular-nums">{row[pair.y]}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </section>;
}
