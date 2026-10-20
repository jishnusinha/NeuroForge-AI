import { useEffect, useMemo, useState } from 'react';
import { deleteF14Run, listF14Runs, saveF14Run } from '../../../services/modelRegistryRepository.js';
import { reviseRunMetadata } from '../../../ml/modelRegistry/runLifecycle.js';
import { compareRunReceipts, REGISTRY_METRICS } from '../../../ml/modelRegistry/comparability.js';
import { replaySavedModel, verifySavedRun } from '../../../ml/modelRegistry/artifactValidator.js';
import { createRunResearchReport } from '../../../ml/modelRegistry/reports.js';

const field='min-h-10 w-full rounded-lg border border-white/20 bg-obsidian px-3 py-2 text-sm text-text-primary';
const button='min-h-10 rounded-lg border border-white/20 bg-obsidian px-3 py-2 text-sm text-text-primary disabled:opacity-40';
const metricFormat=value=>Number.isFinite(value)?Number(value).toFixed(5):'Unavailable';
const diagnosticLabel=run=>run.model.storageMode==='opt_in_artifact'?'Opt-in artifact':'Evidence receipt';
function exportText(text,filename,mime){
  const blob=new Blob([text],{type:mime});
  const url=URL.createObjectURL(blob);
  const element=document.createElement('a');
  element.href=url;element.download=filename;document.body.append(element);
  element.click();element.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function F14RunRegistry(){
  const [runs,setRuns]=useState([]);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const [taskFilter,setTaskFilter]=useState('all');
  const [activeId,setActiveId]=useState('');
  const [compareIds,setCompareIds]=useState([]);
  const [metric,setMetric]=useState('accuracy');
  const [editing,setEditing]=useState(false);
  const [title,setTitle]=useState('');
  const [tags,setTags]=useState('');
  const [notes,setNotes]=useState('');
  const [observations,setObservations]=useState('');
  const [limitations,setLimitations]=useState('');
  const [replayInput,setReplayInput]=useState('');
  const [replayOutput,setReplayOutput]=useState(null);
  const [verification,setVerification]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  const load=async()=>{
    try{
      const items=await listF14Runs();
      setError('');
      setRuns(items);
      setActiveId(previous=>items.some(item=>item.runId===previous)?previous:(items[0]?.runId??''));
      setCompareIds(previous=>previous.filter(id=>items.some(item=>item.runId===id)));
    }catch(reason){setError('Local F14 archive could not be opened: '+reason.message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[]);
  const active=runs.find(item=>item.runId===activeId);
  const visible=useMemo(()=>runs.filter(run=>
    (taskFilter==='all'||run.task.type===taskFilter) &&
    (run.title+' '+run.model.algorithm+' '+run.tags.join(' ')).toLowerCase()
      .includes(query.toLowerCase().trim())),[runs,taskFilter,query]);
  const selected=runs.filter(run=>compareIds.includes(run.runId));
  let comparison=null;
  if(selected.length===2){
    try{comparison=compareRunReceipts(selected[0],selected[1],metric);}
    catch(reason){comparison={status:'unavailable',reasons:[reason.message]};}
  }
  const chooseRun=(run)=>{
    setActiveId(run.runId);setEditing(false);setConfirmDelete('');
    setTitle(run.title);setTags(run.tags.join(', '));setNotes(run.notes);
    setReplayInput('');setReplayOutput(null);setVerification(null);
    setError('');setMessage('');
  };
  const updateMetadata=async()=>{
    if(!active)return;
    setError('');setMessage('');
    try{
      const next=reviseRunMetadata(active,{
        title:title.trim(),tags:tags.split(',').map(x=>x.trim()).filter(Boolean),notes,
      });
      await saveF14Run(next,active.revision);
      setEditing(false);
      await load();setMessage('Saved archive metadata and revision successfully.');
    }catch(reason){setError('Could not update saved run: '+reason.message);}
  };
  const toggleCompare=runId=>{
    setCompareIds(previous=>{
      if(previous.includes(runId))return previous.filter(id=>id!==runId);
      return [...previous.slice(-1),runId];
    });
  };
  const checkReplay=async()=>{
    if(!active)return;
    setError('');setVerification(null);
    try{
      const status=await verifySavedRun(active);
      setVerification(status);
      if(!status.replayable)setMessage(status.reason);
      else setMessage('Saved artifact checksum and structural constraints verified. Prepared-vector replay is available.');
    }catch(reason){setError('Artifact verification failed: '+reason.message);}
  };
  const replay=async()=>{
    if(!active)return;
    setError('');setReplayOutput(null);
    try{
      if(!replayInput.trim() || replayInput.split(',').some(x=>!x.trim()))
        throw new Error('Enter finite numeric values for every prepared feature, separated by commas.');
      const vector=replayInput.split(',').map(x=>Number(x.trim()));
      const output=await replaySavedModel(active,[vector]);
      setReplayOutput(output[0]);
      setMessage('Prediction recomputed using the saved model and the provided prepared numeric vector. No raw source preprocessing was performed.');
    }catch(reason){setError('Replay unavailable: '+reason.message);}
  };
  const deleteRun=async()=>{
    if(!active||confirmDelete!==active.runId)return;
    setError('');
    try{
      await deleteF14Run(active.runId,active.revision);
      setConfirmDelete('');
      await load();
      setMessage('Local F14 research receipt deleted.');
    }catch(reason){setError('Could not delete run: '+reason.message);}
  };
  const report=()=>{
    setError('');
    try{
      const reporting=selected.length?selected:active?[active]:[];
      const markdown=createRunResearchReport(reporting,{
        title:'NeuroForge — F14 Recorded Research',
        observations,limitations,
      });
      exportText(markdown,'neuroforge-f14-research-report.md','text/markdown');
      setMessage('Report generated from saved measurements; no missing results were reconstructed.');
    }catch(reason){setError('Report could not be generated: '+reason.message);}
  };

  return <section aria-label="F14 research run archive" className="space-y-4 rounded-2xl border border-plasma-cyan/25 bg-surface-dark p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-lg font-semibold">F14 — Reproducible Run Registry</h3>
        <p className="text-xs text-text-muted">Owner-scoped, browser-local F12/F13 research evidence. No cloud upload or automatic storage of source data.</p></div>
      <button type="button" onClick={load} className={button}>Refresh local archive</button>
    </div>
    {loading?<p role="status" className="text-sm text-text-muted">Loading local research receipts…</p>
      :<p role="status" className="text-sm text-text-muted">{runs.length} saved F14 research run(s). Record limit: 30 per local account.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">Search saved runs
        <input aria-label="F14 search runs" value={query} onChange={event=>setQuery(event.target.value)} className={'mt-1 '+field} placeholder="Title, model or tag"/>
      </label>
      <label className="text-xs font-semibold">Filter learning task
        <select aria-label="F14 filter task" value={taskFilter} onChange={event=>setTaskFilter(event.target.value)} className={'mt-1 '+field}>
          <option value="all">All tasks</option><option value="binary_classification">Binary classification</option>
          <option value="multiclass_classification">Multiclass classification</option><option value="regression">Regression</option>
        </select>
      </label>
    </div>
    {!loading && runs.length===0&&<p className="rounded-xl border border-white/10 p-4 text-sm text-text-muted">
      No saved F14 research runs. Train a model in Dataset Explorer → F11 Pipeline Studio → F12 Workbench, then choose Save F14 research run.
    </p>}
    <div role="region" aria-label="F14 saved run list" tabIndex={0} className="max-h-72 space-y-2 overflow-auto">
      {visible.map(run=><div key={run.runId} className={'flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 '+(activeId===run.runId?'border-plasma-cyan/40 bg-plasma-cyan/5':'border-white/10 bg-obsidian')}>
        <div className="min-w-0 space-y-1">
          <button type="button" onClick={()=>chooseRun(run)} className="text-left text-sm font-semibold text-plasma-cyan">{run.title}</button>
          <p className="text-xs text-text-muted">{run.model.algorithm} · {run.task.type.replaceAll('_',' ')} · {diagnosticLabel(run)} · revision {run.revision}</p>
          <p className="text-xs text-text-muted">{run.validation.count} validation rows · {run.explanations.length} F13 evidence receipt(s)</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input type="checkbox" aria-label={'F14 compare '+run.title} checked={compareIds.includes(run.runId)}
            onChange={()=>toggleCompare(run.runId)}/> Compare
        </label>
      </div>)}
    </div>
    {!loading&&visible.length===0&&runs.length>0&&<p className="text-xs text-text-muted">No saved runs match the search and task filter.</p>}
    {active&&<section aria-label="F14 run detail" className="space-y-3 rounded-xl border border-white/10 bg-obsidian p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold">{active.title}</h4>
        <button type="button" onClick={()=>{setTitle(active.title);setTags(active.tags.join(', '));setNotes(active.notes);setEditing(!editing);}}
          className={button}>Edit title, tags and notes</button>
      </div>
      <p className="break-all text-xs text-text-muted">
        Source fingerprint: {active.lineage.sourceDigest.slice(0,20)}… · split: {active.lineage.splitDigest.slice(0,20)}… · pipeline: {active.lineage.pipelineDigest.slice(0,20)}…
      </p>
      <p className="text-xs text-text-muted">Prepared features ({active.features.length}): {active.features.join(', ')}</p>
      <p className="text-xs text-text-muted">Recorded population: {active.counts.train} training · {active.counts.validation} validation · {active.counts.test} held-out test.</p>
      <div role="region" aria-label="F14 recorded validation measurements" className="overflow-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[300px] text-left text-xs">
          <caption className="p-2 text-left text-text-muted">Recorded validation metrics · definition version {active.validation.metricDefinitionVersion}</caption>
          <thead><tr><th scope="col" className="p-2">Metric</th><th scope="col" className="p-2">Recorded value</th></tr></thead>
          <tbody>{Object.entries(active.validation.metrics).map(([name,value])=><tr key={name} className="border-t border-white/10">
            <th scope="row" className="p-2">{name}</th><td className="p-2 tabular-nums">{metricFormat(value)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">Final test: {active.finalTest.accessHistory.length?
        'Access recorded at '+active.finalTest.accessHistory[0].accessedAt+'; not used for candidate ranking.':
        'No access recorded in this saved receipt.'}</p>
      <p className="text-xs text-text-muted">F13 attached explanations: {active.explanations.length}.
        {active.explanations.map((item,i)=><span key={i} className="block">Evidence {i+1}: {item.createdAt} · permutation: {item.permutation?.status??'Not recorded'} · PDP: {item.dependence?'Recorded':'Not recorded'}.</span>)}
      </p>
      {editing&&<div className="space-y-2 rounded-lg border border-white/10 p-3">
        <label className="block text-xs font-semibold">Run title
          <input aria-label="F14 edit title" maxLength={100} className={'mt-1 '+field} value={title} onChange={event=>setTitle(event.target.value)}/>
        </label>
        <label className="block text-xs font-semibold">Run tags (comma separated, up to eight)
          <input aria-label="F14 edit tags" className={'mt-1 '+field} value={tags} onChange={event=>setTags(event.target.value)}/>
        </label>
        <label className="block text-xs font-semibold">Research notes
          <textarea aria-label="F14 edit notes" rows={3} maxLength={3000} className={'mt-1 '+field} value={notes} onChange={event=>setNotes(event.target.value)}/>
        </label>
        <button type="button" onClick={updateMetadata} className={button}>Save run metadata</button>
      </div>}
      <div className="space-y-2 rounded-lg border border-white/10 p-3">
        <h5 className="text-sm font-semibold">Fitted model artifact integrity</h5>
        <p className="text-xs text-text-muted">{active.model.storageMode==='opt_in_artifact'?
          'Opt-in fitted model parameters were saved. Inference accepts only prepared numeric feature vectors in the original feature order.' :
          'Receipt-only archive. No fitted weights or training vectors were saved.'}</p>
        <button type="button" onClick={checkReplay} className={button}>Verify saved model artifact</button>
        {verification&&<p role="status" className="text-xs text-text-muted">{verification.replayable?'Artifact checksum verified; replay available.':verification.reason}</p>}
        {active.model.storageMode==='opt_in_artifact'&&<div className="space-y-2">
          <label className="block text-xs font-semibold">Prepared input vector ({active.features.join(', ')})
            <input aria-label="F14 replay prepared vector" className={'mt-1 '+field} value={replayInput}
              placeholder={active.features.map(()=>'0').join(', ')}
              onChange={event=>setReplayInput(event.target.value)}/>
          </label>
          <button type="button" onClick={replay} className={button}>Replay saved model prediction</button>
          {replayOutput&&<p role="status" className="text-xs text-quantum-mint">Replayed prediction: {String(replayOutput.predicted)}
            {replayOutput.probabilities?' · probabilities: '+replayOutput.probabilities.map(metricFormat).join(', '):''}
          </p>}
        </div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {confirmDelete===active.runId?
          <><button type="button" onClick={deleteRun} className={button}>Confirm delete saved F14 run</button>
            <button type="button" onClick={()=>setConfirmDelete('')} className={button}>Cancel deletion</button></>
          :<button type="button" onClick={()=>setConfirmDelete(active.runId)} className={button}>Delete saved F14 run</button>}
      </div>
    </section>}
    {compareIds.length===2&&<section aria-label="F14 comparison" className="space-y-3 rounded-xl border border-white/10 bg-obsidian p-3">
      <h4 className="font-semibold">Scientific run comparison</h4>
      <label className="block max-w-sm text-xs font-semibold">Validation metric
        <select aria-label="F14 comparison metric" className={'mt-1 '+field} value={metric}
          onChange={event=>setMetric(event.target.value)}>
          {Object.keys(REGISTRY_METRICS).map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <p role="status" className="text-sm">Comparison: {comparison?.status??'Unavailable'}
        {comparison?.betterRunId&&' · better recorded validation result: '+selected.find(run=>run.runId===comparison.betterRunId)?.title}.
      </p>
      <div role="region" aria-label="F14 comparison scores" className="overflow-auto">
        <table className="w-full min-w-[300px] text-left text-xs">
          <thead><tr><th scope="col" className="p-2">Run</th><th scope="col" className="p-2">{metric}</th></tr></thead>
          <tbody>{selected.map(run=><tr key={run.runId} className="border-t border-white/10">
            <th scope="row" className="p-2">{run.title}</th><td className="p-2 tabular-nums">{metricFormat(run.validation.metrics[metric])}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {comparison?.reasons?.map(text=><p key={text} className="text-xs text-signal-amber">{text}</p>)}
      {comparison?.notes?.map(text=><p key={text} className="text-xs text-text-muted">{text}</p>)}
    </section>}
    <section aria-label="F14 research report" className="space-y-2 rounded-xl border border-white/10 bg-obsidian p-3">
      <h4 className="font-semibold">Reproducible research report</h4>
      <p className="text-xs text-text-muted">Uses the two checked runs when comparing, otherwise the opened run. Exports recorded validation scores and F13 evidence summaries, never source rows or model parameters.</p>
      <label className="block text-xs font-semibold">Research observations
        <textarea aria-label="F14 report observations" rows={3} maxLength={4000} value={observations}
          onChange={event=>setObservations(event.target.value)} className={'mt-1 '+field}/>
      </label>
      <label className="block text-xs font-semibold">Threats to validity
        <textarea aria-label="F14 report limitations" rows={3} maxLength={4000} value={limitations}
          onChange={event=>setLimitations(event.target.value)} className={'mt-1 '+field}/>
      </label>
      <button type="button" disabled={!active} onClick={report} className={button}>Export F14 Markdown research report</button>
    </section>
    {message&&<p role="status" className="text-sm text-quantum-mint">{message}</p>}
    {error&&<p role="alert" className="text-sm text-signal-amber">{error}</p>}
  </section>;
}
