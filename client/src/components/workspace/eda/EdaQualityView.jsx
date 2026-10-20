import { useMemo } from 'react';
import { qualityEvidence } from '../../../ml/edaQuality.js';

export default function EdaQualityView({ dataset, onInspectRow }) {
  const evidence = useMemo(() => qualityEvidence(dataset), [dataset]);
  return <section aria-label="Advanced data quality" className="space-y-3">
    <p className="text-sm text-text-muted">Read-only review prompts for {evidence.rowCount} included observations. These findings are not proof of error; inspect original rows before correcting any data.</p>
    {!evidence.findings.length && <p role="status" className="rounded-xl border border-white/10 bg-obsidian p-4">No configured quality rules were triggered. This does not certify data quality.</p>}
    {evidence.findings.map(item=><div key={item.id} className="rounded-xl border border-white/10 bg-obsidian p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <h5 className="font-semibold">{item.label}</h5>
        <span className={'rounded-full px-2 py-0.5 text-xs '+(item.severity==='review'?'bg-signal-amber/15 text-signal-amber':'bg-surface-elevated text-text-muted')}>
          {item.severity} · {item.count}
        </span>
      </div>
      <p className="text-xs text-text-muted">Method: {item.method}</p>
      {item.rowIds.length>0 && <div className="flex flex-wrap gap-2" aria-label={'Evidence rows for '+item.label}>
        {item.rowIds.slice(0,8).map(id=><button key={id} type="button" onClick={()=>onInspectRow(id)}
          className="rounded border border-plasma-cyan/25 bg-plasma-cyan/10 px-2 py-1 text-xs text-plasma-cyan">Inspect {id}</button>)}
        {item.rowIds.length>8 && <span className="self-center text-xs text-text-muted">More rows available through filters and Row Explorer</span>}
      </div>}
    </div>)}
  </section>;
}
