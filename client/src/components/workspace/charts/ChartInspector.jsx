const value=v=>v==null?'Unavailable':typeof v==='number'?String(Number(v.toPrecision(7))):String(v);
export default function ChartInspector({spec}){
  const stats=spec.evidence.stats;
  return <aside className="prism-f18-inspector" aria-label="Measured chart statistics">
    <p className="prism-eyebrow">EVIDENCE INSPECTOR</p>
    <dl><dt>Population</dt><dd>{spec.source.rowCount}</dd><dt>Plotted records</dt><dd>{spec.evidence.rows.length}</dd>
      {stats.excludedPairs!==undefined&&<><dt>Excluded pairs</dt><dd>{stats.excludedPairs}</dd></>}
      {stats.complete!==undefined&&<><dt>Complete rows</dt><dd>{stats.complete}</dd><dt>Incomplete rows</dt><dd>{stats.incomplete}</dd></>}
      {stats.displayedRows!==undefined&&<><dt>Displayed rows</dt><dd>{stats.displayedRows} (systematic sample)</dd></>}
      {stats.trainingFitCount!==undefined&&<><dt>Frozen fitting rows</dt><dd>{stats.trainingFitCount}</dd><dt>Measured partition</dt><dd>{stats.partition}</dd><dt>Dropped rows</dt><dd>{stats.droppedRows}</dd></>}
      {stats.fit&&Object.entries(stats.fit).map(([key,v])=><div key={key}><dt>{key}</dt><dd>{value(v)}</dd></div>)}
      {(spec.modelContext||spec.researchContext)&&Object.entries(stats).filter(([,v])=>v===null||['number','string','boolean'].includes(typeof v)).map(([key,v])=><div key={key}><dt>{key}</dt><dd>{value(v)}</dd></div>)}
    </dl>
    {spec.researchContext&&stats.trials?.map(trial=><details key={trial.trial}><summary>Trial {trial.trial} · {trial.status}</summary><dl>{Object.entries(trial).map(([key,v])=><div key={key}><dt>{key}</dt><dd>{value(v)}</dd></div>)}</dl></details>)}
    {stats.neighborDistances&&<dl><dt>Aggregate neighbor distances</dt>{Object.entries(stats.neighborDistances).map(([key,v])=><div key={key}><dt>{key}</dt><dd>{value(v)}</dd></div>)}<dd>Standardized Euclidean distances; neighbor identities are withheld.</dd></dl>}
    {stats.groups?.map((group,i)=><details key={i} open={i===0}><summary>{group.group}</summary><dl>
      {['count','excluded','min','max','mean','q1','median','q3','sd'].map(key=><div key={key}><dt>{key}</dt><dd>{value(group[key])}</dd></div>)}
    </dl></details>)}
    <p className="prism-chart-caption">Exact definitions and fingerprints are in Methods. Use Data for every plotted value.</p>
  </aside>;
}
