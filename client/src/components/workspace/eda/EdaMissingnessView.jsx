import { useMemo } from 'react';
import { missingnessEvidence } from '../../../ml/edaMissingness.js';

export default function EdaMissingnessView({ dataset, onInspectRow }) {
  const evidence = useMemo(() => missingnessEvidence(dataset), [dataset]);
  return <section aria-label="Missingness laboratory" className="space-y-4">
    <p className="text-sm text-text-muted">Measured across {evidence.sourceCount} currently included rows. Blank and null cells are missing. No values are filled in or removed.</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        ['Complete records', evidence.complete],
        ['Incomplete records', evidence.incomplete],
        ['Columns inspected', evidence.columns.length],
      ].map(([label,value])=><div key={label} className="rounded-xl bg-obsidian p-3"><div className="text-xs text-text-muted">{label}</div><div className="text-xl font-semibold tabular-nums">{value}</div></div>)}
    </div>
    <div role="region" aria-label="Missingness by column" tabIndex={0} className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[440px] text-sm">
        <caption className="p-3 text-left text-xs text-text-muted">Exact missing and present counts on included rows.</caption>
        <thead className="bg-surface-elevated"><tr><th scope="col" className="p-2 text-left">Column</th><th scope="col" className="p-2 text-right">Missing</th><th scope="col" className="p-2 text-right">Present</th><th scope="col" className="p-2 text-right">Missing %</th></tr></thead>
        <tbody>{evidence.columns.map(col=><tr key={col.column} className="border-t border-white/10">
          <th scope="row" className="p-2 text-left">{col.column}</th>
          <td className="p-2 text-right tabular-nums">{col.missing}</td>
          <td className="p-2 text-right tabular-nums">{col.observed}</td>
          <td className="p-2 text-right tabular-nums">{evidence.sourceCount ? (100*col.missing/evidence.sourceCount).toFixed(1)+'%' : 'N/A'}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-2">
      <h5 className="font-semibold">Missingness matrix</h5>
      <p className="text-xs text-text-muted">Dark cells indicate observed data; highlighted cells indicate missing values. At most {evidence.displayedCount} deterministic sampled rows are drawn from the included population.</p>
      <div role="img" aria-label={'Missingness matrix: '+evidence.displayedCount+' displayed rows across '+evidence.columns.length+' columns'}
        className="overflow-x-auto rounded-xl border border-white/10 bg-obsidian p-3">
        <div className="min-w-[300px] space-y-1">
          {evidence.displayRows.map(row=><div key={row.id} className="flex items-center gap-1">
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-text-muted">{row.number}</span>
            {row.missing.map((missing,index)=><span key={index} title={evidence.columns[index].column+(missing?': missing':': present')}
              className={'h-2.5 flex-1 rounded-sm '+(missing?'bg-signal-amber':'bg-surface-elevated')} />)}
          </div>)}
        </div>
      </div>
    </div>
    <div role="region" aria-label="Missingness row evidence" className="space-y-2">
      <h5 className="font-semibold">Inspect sampled rows</h5>
      <div className="flex flex-wrap gap-2">
        {evidence.displayRows.filter(row=>row.missing.some(Boolean)).slice(0,12).map(row=>
          <button key={row.id} type="button" onClick={()=>onInspectRow(row.id)}
            className="rounded-lg border border-white/15 bg-obsidian px-3 py-2 text-xs text-text-primary">
            Row {row.number}: {row.missing.filter(Boolean).length} missing
          </button>)}
      </div>
      {!evidence.incomplete && <p role="status" className="text-sm text-text-muted">No incomplete records in the active scope.</p>}
    </div>
  </section>;
}
