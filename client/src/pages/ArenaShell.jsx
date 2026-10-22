import SweepManager from '../components/workspace/SweepManager.jsx';
import ResearchPageHeader from '../design/patterns/ResearchPageHeader.jsx';
import {PrismEmptyState,PrismButton} from '../design/components/Prism.jsx';
import { executeSweep, stopSweep } from '../ml/sweepExecutor.js';
import { getSnapshotLocal } from '../services/localRepository.js';
import { isFeatureEnabled } from '../services/productionConfig.js';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchExperiments } from '../services/api';
import { useLabStore } from '../store/useLabStore';
import { comparisonCompatible, detectsOverfitting, metricAt } from '../ml/experiments';
import { recordedMetricRows, metricHistoryPath } from '../ml/metricSeries.js';

const display = value => Number.isFinite(value) ? value.toFixed(4) : 'Not recorded';
export default function ArenaShell() {
  const navigate = useNavigate();
  const { loadRun, setExperimentName, showToast } = useLabStore();
  const [sweeping,setSweeping]=useState(false);
  const [lastSweep,setLastSweep]=useState(null);
  useEffect(()=>{getSnapshotLocal('last-sweep').then(setLastSweep).catch(()=>{});},[]);
  const startSweep=async (manifest,source)=>{setSweeping(true);useLabStore.getState().setExperimentStatus('Running');try{const result=await executeSweep(manifest,source,progress=>setLastSweep({manifest:progress,source}));setLastSweep({manifest:result,source});setRuns(await fetchExperiments());}catch(error){showToast(error.message,'error');}finally{setSweeping(false);useLabStore.getState().setExperimentStatus('Completed');}};
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baselineId, setBaselineId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [metric, setMetric] = useState('loss');
  const [showDataTable, setShowDataTable] = useState(false);
  const [epoch, setEpoch] = useState(1);
  useEffect(() => {
    let alive = true;
    fetchExperiments().then(data => {
      if (!alive) return;
      setRuns(data); setBaselineId(data[0]?._id || ''); setVariantId(data[1]?._id || '');
      setEpoch(Math.max(1, ...data.flatMap(r => (r.metricHistory || []).map(h => h.epoch || 1))));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  const a = runs.find(r => r._id === baselineId);
  const b = runs.find(r => r._id === variantId);
  const compatible = comparisonCompatible(a, b);
  const maxEpoch = Math.max(1, ...[a, b].flatMap(r => (r?.metricHistory || []).map(h => h.epoch || 1)));
  const selectedEpoch = Math.min(epoch, maxEpoch);
  const histories = [a, b].map(r => (r?.metricHistory || []).filter(h => Number.isFinite(h.epoch)));
  const fields = metric === 'loss' ? ['loss', 'valLoss'] : ['accuracy', 'valAccuracy'];
  const values = histories.flatMap(h => h.flatMap(row => fields.map(field => row[field]).filter(Number.isFinite)));
  const maxValue = Math.max(0.01, ...values);
  const comparisonRows = recordedMetricRows(histories, fields);
  const path = (history, field) => metricHistoryPath(history, field, maxEpoch, maxValue);
  const fork = run => {
    if (!run?.workspace || !run.dataset?.points || (run.workspace === 'studio' && !run.hyperparameters?.layers)) {
      showToast('This legacy record does not contain a runnable configuration.', 'error'); return;
    }
    loadRun(structuredClone(run)); setExperimentName(`Fork of ${run.name}`);
    navigate(`/app/${run.workspace === 'studio' ? 'studio' : 'playground'}`);
  };
  if (loading) return <p className="p-8" role="status">Loading recorded runs...</p>;
  if (!runs.length) return <div className="p-8 space-y-4"><ResearchPageHeader eyebrow="Research / Comparison" title="Experiment Arena"/><PrismEmptyState title="Build a comparison from measured evidence" action={<PrismButton as={Link} to="/app/playground">Open Playground</PrismButton>}>Run and save two experiments to compare their recorded results.</PrismEmptyState></div>;
  return <div className="p-4 lg:p-6 space-y-5 overflow-auto">
    <ResearchPageHeader eyebrow="Research / Comparison" title="Experiment Arena" description="Compare recorded measurements only when source and evaluation populations are compatible. Missing evidence remains unavailable."/>
    <div className="grid md:grid-cols-2 gap-4">
      {[['Baseline', baselineId, setBaselineId], ['Variant', variantId, setVariantId]].map(([label, id, setter]) => <label key={label} className="space-y-2 text-sm">{label}<select aria-label={label} value={id} onChange={e => setter(e.target.value)} className="block w-full p-3 rounded-xl bg-obsidian border border-white/10"><option value="">Select a run</option>{runs.map(run => <option key={run._id} value={run._id}>{run.name}</option>)}</select></label>)}
    </div>
    <p role="status" className={`p-3 rounded-xl border ${compatible ? 'border-emerald-400 text-emerald-300' : 'border-amber-400 text-amber-300'}`}>
      {compatible ? 'Matched task, dataset fingerprint, evaluation split, and preprocessing.' : 'Direct comparison unavailable: select runs with matching tasks, recorded datasets, evaluation splits, and preprocessing. Clustering runs are inspected individually.'}
    </p>
    <div className="grid md:grid-cols-2 gap-4">{[a, b].map((run, i) => {
      if (!run) return <p key={i}>Select a run.</p>;
      const metrics = metricAt(run, selectedEpoch);
      return <article key={i} className="p-4 rounded-xl bg-obsidian space-y-2">
        <h3 className="font-semibold">{run.name}</h3><p className="text-xs text-slate-400">{run.algorithm} · {run.dataset?.name}</p>
        <dl className="text-sm grid grid-cols-2 gap-2"><dt>Training loss / MSE</dt><dd>{display(metrics.loss)}</dd><dt>Validation loss / MSE</dt><dd>{display(metrics.valLoss)}</dd><dt>Validation accuracy</dt><dd>{Number.isFinite(metrics.acc) ? `${(metrics.acc * 100).toFixed(1)}%` : 'Not recorded'}</dd><dt>Inertia</dt><dd>{display(run.metrics?.inertia)}</dd></dl>
        <p className="text-xs text-slate-400">{detectsOverfitting(run) ? 'Validation loss rises after its minimum while training loss declines; this suggests overfitting.' : 'Recorded history does not establish an overfitting trend.'}</p>
        <button onClick={() => fork(run)} className="px-3 py-2 rounded bg-violet-400/20 text-violet-200">Duplicate & Improve</button>
      </article>;
    })}</div>
    {compatible && <>
      <label className="flex gap-4 items-center text-sm">Recorded timeline: epoch {selectedEpoch}<input aria-label="Comparison epoch" type="range" min="1" max={maxEpoch} value={selectedEpoch} onChange={e => setEpoch(Number(e.target.value))} /></label>
      <p className="text-xs text-slate-400">Values use the last recorded epoch at or before the selected time. Missing measurements remain unavailable.</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3" role="group" aria-label="Comparison metric">
          {['loss', 'accuracy'].map(value => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)} className="rounded bg-surface-elevated px-3 py-2 capitalize">{value}</button>)}
        </div>
        <button type="button" aria-pressed={showDataTable} onClick={() => setShowDataTable(value => !value)} className="rounded border border-cyan-400/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">
          {showDataTable ? 'Show comparison chart' : 'Show comparison data table'}
        </button>
      </div>
      {showDataTable ? (
        <div role="region" aria-label="Recorded comparison data" tabIndex={0} className="max-h-80 max-w-full overflow-auto rounded-xl border border-white/10 bg-obsidian">
          <table className="w-full min-w-[540px] text-left text-xs">
            <caption className="px-3 py-2 text-left text-slate-300">Recorded {metric} measurements — selected epoch {selectedEpoch}. Missing measurements are not inferred.</caption>
            <thead className="sticky top-0 bg-surface-elevated text-slate-200"><tr>
              <th scope="col" className="p-3">Epoch</th>
              <th scope="col" className="p-3">Baseline train</th>
              <th scope="col" className="p-3">Baseline validation</th>
              <th scope="col" className="p-3">Variant train</th>
              <th scope="col" className="p-3">Variant validation</th>
            </tr></thead>
            <tbody>
              {comparisonRows.length ? comparisonRows.map(row => <tr key={row.epoch} aria-current={row.epoch === selectedEpoch ? 'true' : undefined} className={`border-t border-white/10 ${row.epoch === selectedEpoch ? 'bg-cyan-400/10' : ''}`}>
                <th scope="row" className="p-3 font-semibold"><button type="button" aria-label={`Inspect epoch ${row.epoch}`} onClick={() => setEpoch(row.epoch)} className="rounded px-2 py-1 text-cyan-200 hover:bg-white/10">{row.epoch}</button></th>
                {row.values.map((value, index) => <td key={index} className="p-3 tabular-nums">{display(value)}</td>)}
              </tr>) : <tr><td colSpan={5} className="p-3 text-slate-300">No epoch-level measurements were recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <svg role="img" aria-label={`Recorded ${metric} curves: cyan baseline, violet variant; dashed validation`} viewBox="0 0 600 210" className="w-full max-h-80 bg-obsidian rounded-xl">
          <text x="20" y="15" fill="#9EACC4" fontSize="10">{maxValue.toFixed(3)}</text>
          {histories.map((history, i) => fields.map((field, j) => <path key={`${i}-${field}`} d={path(history, field)} fill="none" stroke={i ? '#A78BFA' : '#46D7F2'} strokeWidth="2" strokeDasharray={j ? '5 4' : undefined} />))}
          {/* Sparse checkpoints must still be visible when interpolation is intentionally omitted. */}
          {histories.map((history, i) => fields.flatMap((field, j) => history
            .filter(row => Number.isFinite(row[field]))
            .map(row => <circle key={`${i}-${field}-${row.epoch}`}
              cx={20 + row.epoch / maxEpoch * 560}
              cy={180 - row[field] / maxValue * 160}
              r={j ? 2.3 : 3.2}
              fill={i ? '#A78BFA' : '#46D7F2'}
              stroke="#151E30" strokeWidth="0.8" />)
          ))}
          <line x1={20 + selectedEpoch / maxEpoch * 560} x2={20 + selectedEpoch / maxEpoch * 560} y1="20" y2="180" stroke="#3CD5AA" strokeDasharray="3 3" />
          <text x="20" y="200" fill="#9EACC4" fontSize="10">0</text><text x="530" y="200" fill="#9EACC4" fontSize="10">Epoch {maxEpoch}</text>
        </svg>
      )}
      <p className="text-xs text-slate-400">Cyan: baseline · Violet: variant · Solid: training · Dashed: validation. The table contains exact recorded epochs without filling gaps.</p>
    </>}
  {isFeatureEnabled('sweeps_and_arena') && <section className="p-4 space-y-3"><p>Sweeps use the selected baseline Studio run and its fixed validation set. Test samples are excluded.</p><SweepManager existingRuns={runs.filter(run=>run.workspace==='studio')} baseConfig={{learningRate:a?.hyperparameters.learningRate ?? .01,batchSize:a?.hyperparameters.batchSize ?? 16,epochs:Math.min(a?.hyperparameters.epochs ?? 20,100)}} running={sweeping} onRun={a?.workspace==='studio' ? manifest=>startSweep(manifest,a) : undefined}/>{sweeping&&<button onClick={stopSweep}>Stop sweep</button>}{lastSweep&&<div><p>Sweep: {lastSweep.manifest.status} - {lastSweep.manifest.jobs.filter(job=>job.status==='completed').length}/{lastSweep.manifest.totalJobs} completed</p><button disabled={sweeping} onClick={()=>startSweep(lastSweep.manifest,lastSweep.source)}>Resume unfinished / retry failed trials</button>{lastSweep.manifest.jobs.filter(job=>job.error).map(job=><p key={job.jobId} role="alert">{job.jobId}: {job.error}</p>)}</div>}</section>}</div>;
}
