import { useEffect, useMemo, useState } from 'react';
import { getSnapshotLocal, saveSnapshotLocal } from '../../services/localRepository.js';
import { createEvidenceReport } from '../../ml/evidenceReport.js';
import { buildRunComparison, notebookRunId, NOTEBOOK_METRICS } from '../../ml/researchNotebook.js';

const NOTEBOOK_ID='research-notebook-v1';
const metricString = value => Number.isFinite(value)?Number(value.toFixed(4)).toLocaleString():'Not recorded';

export default function ResearchNotebook({ experiments = [] }) {
  const [title,setTitle] = useState('Experiment Research Notes');
  const [observations,setObservations] = useState('');
  const [limitations,setLimitations] = useState('');
  const [metric,setMetric] = useState('valAccuracy');
  const [selected,setSelected] = useState([]);
  const [storageState,setStorageState] = useState('loading');
  const [report,setReport] = useState(null);
  const [error,setError] = useState('');

  useEffect(()=>{
    let active=true;
    getSnapshotLocal(NOTEBOOK_ID)
      .then(saved=>{
        if(!active)return;
        if(saved){
          setTitle(saved.title||'Experiment Research Notes');
          setObservations(saved.observations||'');
          setLimitations(saved.limitations||'');
          setMetric(NOTEBOOK_METRICS[saved.metric]?saved.metric:'valAccuracy');
          setSelected(Array.isArray(saved.selected)?saved.selected:[]);
        }
        setStorageState('ready');
      }).catch(reason=>{if(active){setError(reason.message);setStorageState('failed');}});
    return()=>{active=false;};
  },[]);

  const included = useMemo(()=>experiments.filter(run=>selected.includes(notebookRunId(run))),[experiments,selected]);
  const comparison = useMemo(()=>buildRunComparison(included,metric),[included,metric]);

  const toggle = id => {
    setSelected(previous=>previous.includes(id)?previous.filter(item=>item!==id):[...previous,id]);
    setReport(null);
  };
  const save = async () => {
    try {
      await saveSnapshotLocal({
        id:NOTEBOOK_ID,title,observations,limitations,selected,metric,
        updatedAt:new Date().toISOString(),
      });
      setStorageState('saved');
      setError('');
    }catch(reason){setStorageState('failed');setError(reason.message);}
  };
  const generate = () => {
    try {
      const evidence=createEvidenceReport({
        title,projectId:'NeuroForge local research',
        runs:included,observations,limitations,
        isLive:false,
      });
      setReport(evidence);
      setError('');
    }catch(reason){setReport(null);setError(reason.message);}
  };
  const copy = async () => {
    try {
      if(!report)throw new Error('Generate a report first.');
      await navigator.clipboard.writeText(report.markdownContent);
      setStorageState('copied');
      setError('');
    }catch(reason){setError('Clipboard unavailable: '+reason.message);}
  };
  return <section role="region" aria-label="Research Notebook" className="space-y-4 rounded-2xl border border-violet-400/20 bg-surface-dark p-4 sm:p-5">
    <div>
      <h3 className="text-lg font-semibold text-white">Research Notebook</h3>
      <p className="mt-1 text-xs text-text-muted">Select saved runs, annotate measured outcomes and generate a reproducible evidence report. Notes remain in your browser's local storage; they are not cloud-synced.</p>
      {storageState==='saved'&&<p role="status" className="mt-2 text-xs text-emerald-200">Notebook saved locally.</p>}
      {storageState==='loading'&&<p role="status" className="mt-2 text-xs text-text-muted">Loading local notebook…</p>}
      {storageState==='failed'&&<p role="status" className="mt-2 text-xs text-amber-200">Local notebook storage unavailable. You can still generate a report without saving it.</p>}
    </div>
    <label className="block text-xs font-medium text-text-muted">Notebook title
      <input aria-label="Notebook title" value={title} maxLength={100}
        onChange={event=>{setTitle(event.target.value);setReport(null);}}
        className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-obsidian px-3 text-sm text-white"/>
    </label>
    <fieldset className="space-y-2 rounded-xl border border-white/10 bg-obsidian p-3">
      <legend className="px-2 text-xs font-semibold text-white">Include saved runs ({included.length})</legend>
      {experiments.length===0?<p className="text-sm text-text-muted">No saved runs yet. Train and save an experiment in Playground or Studio to link it here.</p>:
        <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
          {experiments.slice(0,60).map(run=>{
            const id=notebookRunId(run);
            return <label key={id} className="flex items-start gap-2 rounded-lg bg-surface-dark p-2 text-xs text-white">
              <input aria-label={`Include run ${run.name||id}`} type="checkbox" checked={selected.includes(id)}
                onChange={()=>toggle(id)} className="mt-0.5"/>
              <span className="min-w-0 break-words"><strong>{run.name||id}</strong><span className="mt-1 block text-text-muted">{run.algorithm||'Unknown algorithm'} · {run.dataset?.name||'Unknown dataset'}</span></span>
            </label>;
          })}
        </div>}
    </fieldset>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-text-muted">Observations
        <textarea aria-label="Notebook observations" rows={4} maxLength={5000} value={observations}
          onChange={event=>{setObservations(event.target.value);setReport(null);}}
          className="mt-1 w-full rounded-lg border border-white/20 bg-obsidian p-3 text-sm text-white"/>
      </label>
      <label className="text-xs font-medium text-text-muted">Limitations & threats to validity
        <textarea aria-label="Notebook limitations" rows={4} maxLength={3000} value={limitations}
          onChange={event=>{setLimitations(event.target.value);setReport(null);}}
          className="mt-1 w-full rounded-lg border border-white/20 bg-obsidian p-3 text-sm text-white"/>
      </label>
    </div>
    <label className="block max-w-sm text-xs font-medium text-text-muted">Compare recorded metric
      <select aria-label="Notebook comparison metric" value={metric} onChange={event=>setMetric(event.target.value)}
        className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-obsidian px-3 text-sm text-white">
        {Object.entries(NOTEBOOK_METRICS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
      </select>
    </label>
    {included.length>0 && <div role="region" aria-label="Notebook run comparison" tabIndex={0} className="max-h-72 overflow-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[540px] text-left text-xs">
        <caption className="p-3 text-left text-text-muted">Recorded {comparison.label.toLowerCase()} for {comparison.compared} selected run(s); {comparison.measured} have actual numeric evidence.</caption>
        <thead className="bg-surface-elevated"><tr>{['Run','Algorithm','Dataset','Seed',comparison.label].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead>
        <tbody>{comparison.rows.map(row=><tr key={row.id} className="border-t border-white/10">
          <th scope="row" className="p-2">{row.name}</th><td className="p-2">{row.algorithm}</td>
          <td className="p-2">{row.dataset}</td><td className="p-2">{row.seed ?? 'Not recorded'}</td>
          <td className="p-2 tabular-nums">{metricString(row.metric)}</td>
        </tr>)}</tbody>
      </table>
      {comparison.mixedDatasets && <p role="status" className="border-t border-amber-400/20 p-3 text-xs text-amber-200">Runs use different datasets. Their raw metric rankings are not controlled comparisons.</p>}
    </div>}
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={save} className="min-h-11 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600">Save notebook locally</button>
      <button type="button" onClick={generate} className="min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Generate evidence report</button>
    </div>
    {report && <div role="region" aria-label="Generated research report" className="space-y-2">
      <p className="text-sm font-medium text-emerald-200">Evidence report generated from {report.runSummaries.length} selected recorded run(s).</p>
      <textarea aria-label="Research report Markdown" readOnly rows={12} value={report.markdownContent}
        className="w-full rounded-xl border border-white/20 bg-obsidian p-3 font-mono text-xs text-white"/>
      <button type="button" onClick={copy} className="min-h-10 rounded-lg border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10">Copy Markdown report</button>
    </div>}
    {error&&<p role="alert" className="rounded-lg border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}
  </section>;
}
