import { useEffect, useMemo, useRef, useState } from 'react';
import { validateExplanationContext } from '../../../ml/modelWorkbench/explainabilityContracts.js';
import { explainLocalPrediction } from '../../../ml/modelWorkbench/localExplanations.js';
import { partialDependence } from '../../../ml/modelWorkbench/partialDependence.js';
import { sourceFeatureControls, sourceWhatIf } from '../../../ml/modelWorkbench/whatIfDiagnostics.js';
import { subgroupDiagnostics } from '../../../ml/modelWorkbench/subgroupDiagnostics.js';
import { createExplanationReceipt } from '../../../ml/modelWorkbench/explanationEvidence.js';

const inputClass='mt-1 min-h-10 w-full rounded-lg border border-white/20 bg-obsidian px-2 py-2 text-sm text-text-primary';
const buttonClass='min-h-10 rounded-lg border border-white/20 bg-obsidian px-3 py-2 text-sm text-text-primary disabled:opacity-40';
const displayNumber=value=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(4):'Unavailable';
const displayPrediction=value=>typeof value==='number'?displayNumber(value):String(value);
const views=[
  {id:'importance',name:'Global importance'},
  {id:'local',name:'Local explanation'},
  {id:'dependence',name:'PDP / ICE'},
  {id:'whatif',name:'What-if'},
  {id:'subgroups',name:'Subgroups'},
];

function ExportButton({ matrix, model, candidate, importance, local, dependence, whatIf, subgroups, onError, onMessage }) {
  const run=async()=>{
    try{
      const receipt=await createExplanationReceipt({
        matrix,model,candidateId:candidate.id,importance,local,dependence,whatIf,subgroups,
      });
      const blob=new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download='neuroforge-f13-explanation.json';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      onError('');onMessage('Explanation evidence exported without individual row identifiers, source values or fitted model parameters.');
    }catch(error){onError(error.message);}
  };
  return <button type="button" onClick={run} className={buttonClass}>Export explanation evidence JSON</button>;
}

function ImportancePanel({ importance, job, onStart, onCancel }) {
  return <section aria-label="F13 permutation importance" className="space-y-3">
    <h5 className="font-semibold">Repeated permutation importance</h5>
    <p className="text-xs text-text-muted">Measures score degradation after a seeded column shuffle within validation observations. Positive importance indicates worse scores after shuffling; negative results are possible. Correlated features may share importance.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onStart} disabled={job.status==='running'}
        className="min-h-11 rounded-lg bg-plasma-cyan px-4 text-sm font-semibold text-ink-on-accent disabled:opacity-40">
        {job.status==='running'?'Measuring…':'Measure feature importance'}
      </button>
      {job.status==='running'&&<button type="button" onClick={onCancel} className={buttonClass}>Cancel analysis</button>}
    </div>
    <p role="status" className="text-xs text-text-muted">
      {job.status==='running'?('Analyzed '+job.completed+' of '+job.total+' features; cancellable worker.')
        :job.status==='cancelled'?'Analysis cancelled.':job.status==='failed'?'Analysis failed.':
          importance?'Feature importance measured.':'No global importance calculation requested.'}
    </p>
    {importance?.status==='unavailable'&&<p className="text-sm text-signal-amber">{importance.reason}</p>}
    {importance?.status==='ok'&&<div className="space-y-3">
      <p className="text-sm">Baseline validation {importance.metric}: <strong>{displayNumber(importance.baselineScore)}</strong>
        <span className="block text-xs text-text-muted">{importance.sampleCount} of {importance.sourceCount} validation rows · {importance.repeats} repeats · seed {importance.seed}</span>
      </p>
      <div className="space-y-2" role="img" aria-label="Permutation feature-importance bars; exact values are in the following table">
        {importance.features.map(item=>{
          const max=Math.max(0.000001,...importance.features.map(f=>Math.abs(f.meanImportance)));
          return <div key={item.name} className="space-y-1">
            <div className="flex justify-between gap-2 text-xs"><span className="break-all">{item.name}</span><span className="tabular-nums">{displayNumber(item.meanImportance)}</span></div>
            <div className="h-2.5 rounded bg-surface-elevated">
              <div style={{width:(100*Math.abs(item.meanImportance)/max)+'%'}} className={'h-full rounded '+(item.meanImportance>=0?'bg-plasma-cyan':'bg-signal-amber')}/>
            </div>
          </div>;
        })}
      </div>
      <div role="region" aria-label="F13 importance evidence table" tabIndex={0} className="overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead><tr><th scope="col" className="p-2">Prepared feature</th><th scope="col" className="p-2">Mean score degradation</th><th scope="col" className="p-2">Variation (SD)</th></tr></thead>
          <tbody>{importance.features.map(item=><tr key={item.name} className="border-t border-white/10">
            <th scope="row" className="p-2">{item.name}</th>
            <td className="p-2 tabular-nums">{displayNumber(item.meanImportance)}</td>
            <td className="p-2 tabular-nums">{displayNumber(item.standardDeviation)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {importance.limitations.map(line=><p key={line} className="text-xs text-text-muted">{line}</p>)}
    </div>}
  </section>;
}

function LocalPanel({ explanation }) {
  const linear=explanation.contributions.length>0;
  return <section aria-label="F13 local explanation" className="space-y-3">
    <h5 className="font-semibold">Local model explanation</h5>
    <p className="text-sm">Prediction: <strong>{displayPrediction(explanation.modelOutput.predicted)}</strong>
      {explanation.modelOutput.probabilities&&
        <span className="block text-xs text-text-muted">Class probabilities: {explanation.modelOutput.probabilities.map(displayNumber).join(' · ')}</span>}
    </p>
    <p className="text-xs text-text-muted">{explanation.explanation}</p>
    {linear&&<>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-dark p-3"><div className="text-xs text-text-muted">Intercept</div><div className="tabular-nums">{displayNumber(explanation.intercept)}</div></div>
        <div className="rounded-lg bg-surface-dark p-3"><div className="text-xs text-text-muted">Sum ({explanation.scale})</div><div className="tabular-nums">{displayNumber(explanation.total)}</div></div>
      </div>
      <div role="region" aria-label="F13 local contribution evidence" tabIndex={0} className="overflow-auto rounded-lg border border-white/10">
        <table className="min-w-[370px] w-full text-left text-xs">
          <thead><tr><th scope="col" className="p-2">Prepared feature</th><th scope="col" className="p-2">Contribution</th></tr></thead>
          <tbody>{explanation.contributions.map(item=><tr key={item.feature} className="border-t border-white/10">
            <th scope="row" className="p-2">{item.feature}</th>
            <td className="p-2 tabular-nums">{displayNumber(item.contribution)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
    {explanation.votes&&<>
      <h6 className="text-sm font-semibold">Training-neighbor vote evidence</h6>
      <div role="region" aria-label="F13 kNN class vote evidence" className="overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-xs">
          <thead><tr><th scope="col" className="p-2">Class</th><th scope="col" className="p-2">Votes</th></tr></thead>
          <tbody>{explanation.votes.map(item=><tr key={String(item.name)} className="border-t border-white/10">
            <th scope="row" className="p-2">{String(item.name)}</th><td className="p-2">{item.count}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">Neighbor distances: {explanation.neighbors.map(item=>displayNumber(item.distance)).join(', ')}. Original training row values and identities are not displayed.</p>
    </>}
    {explanation.classPrior&&<p className="text-xs text-text-muted">Training class priors: {explanation.classPrior.map(displayNumber).join(', ')}</p>}
  </section>;
}

function DependencePanel({ matrix, feature, setFeature, classIndex, setClassIndex, result, onCalculate }) {
  const values=result?.points??[];
  const minimum=values.length?Math.min(...values.map(p=>p.meanPrediction)):0;
  const maximum=values.length?Math.max(...values.map(p=>p.meanPrediction)):1;
  const denominator=maximum-minimum||1;
  const width=520,height=150;
  const points=values.map((point,index)=>{
    const x=18+index*(width-36)/Math.max(1,values.length-1);
    const y=height-16-(point.meanPrediction-minimum)/denominator*(height-32);
    return x+','+y;
  }).join(' ');
  return <section aria-label="F13 partial dependence" className="space-y-3">
    <h5 className="font-semibold">Partial dependence and ICE</h5>
    <p className="text-xs text-text-muted">Prepared-feature sweeps across the training-data range, evaluated against bounded validation background rows. Hypothetical combinations may be unrealistic. Results are not causal.</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-semibold">Prepared feature
        <select aria-label="F13 dependence feature" className={inputClass} value={feature} onChange={event=>setFeature(event.target.value)}>
          {matrix.features.map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {matrix.task.type!=='regression'&&<label className="text-xs font-semibold">Predicted class
        <select aria-label="F13 dependence class" className={inputClass} value={classIndex} onChange={event=>setClassIndex(Number(event.target.value))}>
          {matrix.task.classes.map((name,index)=><option key={index} value={index}>{String(name)}</option>)}
        </select>
      </label>}
    </div>
    <button type="button" className={buttonClass} onClick={onCalculate}>Calculate partial dependence</button>
    {result&&<div className="space-y-3">
      <p className="text-sm font-semibold">{result.output} · {result.sampleCount} background rows · {result.points.length} grid points</p>
      <svg role="img" aria-label="Partial dependence line; exact values are listed in the table" viewBox={'0 0 '+width+' '+height} className="w-full rounded-lg border border-white/10 bg-surface-dark">
        <line x1="18" y1={height-16} x2={width-18} y2={height-16} stroke="currentColor" opacity="0.35"/>
        <polyline points={points} fill="none" stroke="#5BD5E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div role="region" aria-label="F13 partial dependence evidence" tabIndex={0} className="max-h-64 overflow-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-xs"><thead><tr><th scope="col" className="p-2">Prepared feature value</th><th scope="col" className="p-2">Mean prediction</th></tr></thead>
          <tbody>{result.points.map((point,index)=><tr key={index} className="border-t border-white/10">
            <td className="p-2 tabular-nums">{displayNumber(point.value)}</td>
            <td className="p-2 tabular-nums">{displayNumber(point.meanPrediction)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">{result.curves.length} individual conditional expectation (ICE) curves computed. Exact values are included in the analysis but not automatically exported at row level.</p>
      {result.limitations.map(line=><p key={line} className="text-xs text-text-muted">{line}</p>)}
    </div>}
  </section>;
}

function WhatIfPanel({ controls, editFeature, setEditFeature, editValue, setEditValue, sourceValue, onRun, result }) {
  const choice=controls.find(item=>item.name===editFeature);
  return <section aria-label="F13 source what-if" className="space-y-3">
    <h5 className="font-semibold">Frozen-pipeline source what-if</h5>
    <p className="text-xs text-text-muted">Change one original feature within its observed training range or allowed training category. The frozen F11 transformations replay without refitting. These are hypothetical model predictions, not real-world interventions.</p>
    {controls.some(item=>item.editable)?<>
      <label className="block text-xs font-semibold">Original input feature
        <select aria-label="F13 source edit feature" className={inputClass} value={editFeature}
          onChange={event=>{setEditFeature(event.target.value);setEditValue('');}}>
          {controls.filter(item=>item.editable).map(item=><option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      {choice&&<div className="space-y-2">
        <p className="text-xs text-text-muted">Original observed value: {sourceValue===null||sourceValue===undefined?'Missing':String(sourceValue)}</p>
        {choice.type==='numeric'
          ?<label className="block text-xs font-semibold">Hypothetical numeric value ({choice.min} to {choice.max})
            <input type="number" step="any" aria-label="F13 hypothetical numeric value" className={inputClass}
              min={choice.min} max={choice.max} value={editValue}
              placeholder="Within observed training range" onChange={event=>setEditValue(event.target.value)}/>
          </label>
          :<label className="block text-xs font-semibold">Hypothetical category
            <select aria-label="F13 hypothetical category" className={inputClass} value={editValue||choice.choices[0]}
              onChange={event=>setEditValue(event.target.value)}>
              {choice.choices.map(value=><option key={value} value={value}>{value}</option>)}
            </select>
          </label>}
        <button type="button" onClick={onRun} className={buttonClass}>Evaluate hypothetical prediction</button>
      </div>}
    </>:<p role="status" className="text-xs text-text-muted">No editable original features are available from the training scope.</p>}
    {result&&<div className="space-y-2 rounded-lg border border-white/10 bg-surface-dark p-3">
      <h6 className="font-semibold">Model response to hypothetical input</h6>
      <p className="text-sm">Original prediction: <strong>{displayPrediction(result.originalPrediction)}</strong></p>
      <p className="text-sm">Hypothetical prediction: <strong>{displayPrediction(result.hypotheticalPrediction)}</strong></p>
      {result.regressionDelta!==null&&<p className="text-xs text-text-muted">Prediction change: {displayNumber(result.regressionDelta)}</p>}
      {result.hypotheticalProbabilities&&<p className="text-xs text-text-muted">Hypothetical class probabilities: {result.hypotheticalProbabilities.map(displayNumber).join(' · ')}</p>}
      {result.limitations.map(line=><p key={line} className="text-xs text-text-muted">{line}</p>)}
    </div>}
  </section>;
}

function SubgroupsPanel({ feature, setFeature, matrix, result, onRun }) {
  return <section aria-label="F13 subgroup diagnostics" className="space-y-3">
    <h5 className="font-semibold">Feature-range performance</h5>
    <p className="text-xs text-text-muted">Two groups divided at the TRAIN median, measured only on validation observations. Differences are descriptive; small groups cannot support a reliable estimate.</p>
    <label className="block max-w-sm text-xs font-semibold">Prepared grouping feature
      <select aria-label="F13 subgroup feature" className={inputClass} value={feature} onChange={event=>setFeature(event.target.value)}>
        {matrix.features.map(name=><option key={name} value={name}>{name}</option>)}
      </select>
    </label>
    <button type="button" className={buttonClass} onClick={onRun}>Analyze validation subgroups</button>
    {result&&<div className="space-y-2">
      <p className="text-xs text-text-muted">Method: {result.method}; training median {displayNumber(result.boundary)}; metric {result.metric}.</p>
      <div role="region" aria-label="F13 subgroup evidence" tabIndex={0} className="overflow-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[400px] text-left text-xs">
          <thead><tr><th scope="col" className="p-2">Group</th><th scope="col" className="p-2">Support</th><th scope="col" className="p-2">{result.metric}</th></tr></thead>
          <tbody>{result.groups.map(item=><tr key={item.name} className="border-t border-white/10">
            <th scope="row" className="p-2">{item.name}</th>
            <td className="p-2">{item.count}</td><td className="p-2">{item.status==='ok'?displayNumber(item.metricValue):item.reason}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {result.limitations.map(line=><p key={line} className="text-xs text-text-muted">{line}</p>)}
    </div>}
  </section>;
}

export default function ExplainabilityStudio({ matrix, candidate, plan }) {
  const model=candidate.model;
  const validRows=useMemo(()=>validateExplanationContext(matrix,model),[matrix,model]);
  const controls=useMemo(()=>sourceFeatureControls(plan,matrix),[plan,matrix]);
  const [active,setActive]=useState('importance');
  const [rowId,setRowId]=useState(validRows[0].id);
  const [feature,setFeature]=useState(matrix.features[0]);
  const [classIndex,setClassIndex]=useState(Math.max(0,matrix.task.classes.length-1));
  const [editFeature,setEditFeature]=useState(controls.find(item=>item.editable)?.name??'');
  const [editValue,setEditValue]=useState('');
  const [importance,setImportance]=useState(null);
  const [pdp,setPdp]=useState(null);
  const [whatIf,setWhatIf]=useState(null);
  const [subgroups,setSubgroups]=useState(null);
  const [job,setJob]=useState({status:'idle',completed:0,total:0});
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const workerRef=useRef(null);
  const requestIdRef=useRef(0);
  useEffect(()=>()=>{workerRef.current?.terminate();},[]);

  const local=useMemo(()=>explainLocalPrediction(matrix,model,rowId),[matrix,model,rowId]);
  const rawRow=plan.raw.find(row=>row.id===rowId);
  const selectedControl=controls.find(item=>item.name===editFeature);

  const cancel=()=>{
    if(workerRef.current){workerRef.current.terminate();workerRef.current=null;}
    setJob(previous=>({...previous,status:'cancelled'}));
  };
  const measure=()=>{
    cancel();setImportance(null);setError('');setMessage('');
    const id=++requestIdRef.current;
    const worker=new Worker(new URL('../../../ml/modelWorkbench/explanationWorker.js',import.meta.url),{type:'module'});
    workerRef.current=worker;
    setJob({status:'running',completed:0,total:Math.min(12,matrix.features.length)});
    worker.onmessage=event=>{
      if(workerRef.current!==worker||event.data?.requestId!==id)return;
      if(event.data.type==='progress'){
        setJob(prev=>({...prev,completed:event.data.completed,total:event.data.total}));
      } else {
        worker.terminate();workerRef.current=null;
        if(event.data.type==='result'){
          setImportance(event.data.result);setJob({status:'complete',completed:0,total:0});
        } else {
          setError(event.data.message??'Feature-importance job failed.');
          setJob({status:'failed',completed:0,total:0});
        }
      }
    };
    worker.onerror=()=>{
      if(workerRef.current!==worker)return;
      worker.terminate();workerRef.current=null;
      setJob({status:'failed',completed:0,total:0});setError('Explanation worker failed to start.');
    };
    worker.postMessage({requestId:id,matrix,model,options:{
      metric:matrix.task.type==='regression'?'rmse':'accuracy',
      repeats:3,maxRows:80,maxFeatures:12,seed:42,
    }});
  };
  const calculate=()=>{
    setError('');
    try{setPdp(partialDependence(matrix,model,{feature,
      classLabel:matrix.task.type==='regression'?null:matrix.task.classes[classIndex]}));}
    catch(reason){setPdp(null);setError(reason.message);}
  };
  const inspectSubgroups=()=>{
    setError('');
    try{setSubgroups(subgroupDiagnostics(matrix,model,{feature}));}
    catch(reason){setSubgroups(null);setError(reason.message);}
  };
  const evaluateWhatIf=()=>{
    setError('');
    try{
      const value=selectedControl?.type==='numeric'?Number(editValue):
        editValue||selectedControl?.choices[0];
      if(selectedControl?.type==='numeric'&&editValue.trim()==='')
        throw new Error('Enter a numeric hypothetical value.');
      setWhatIf(sourceWhatIf(matrix,model,plan,rowId,{[editFeature]:value}));
    }catch(reason){setWhatIf(null);setError(reason.message);}
  };

  return <details className="rounded-xl border border-quantum-mint/30 bg-surface-dark p-3 sm:p-4">
    <summary className="cursor-pointer text-base font-semibold">
      F13 — Explainability & Diagnostics Studio
      <span className="mt-1 block text-xs font-normal text-text-muted">Explore the selected fitted candidate using only validation observations; the held-out test remains sealed</span>
    </summary>
    <div role="region" aria-label="F13 Explainability Studio" className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg border border-white/10 bg-obsidian px-3 py-2">Algorithm: {model.algorithm}</span>
        <span className="rounded-lg border border-white/10 bg-obsidian px-3 py-2">{matrix.features.length} prepared inputs</span>
        <span className="rounded-lg border border-white/10 bg-obsidian px-3 py-2">Validation: {validRows.length} observations</span>
      </div>
      <div role="group" aria-label="F13 diagnostic views" className="flex flex-wrap gap-2">
        {views.map(view=><button key={view.id} type="button" aria-pressed={active===view.id}
          onClick={()=>{setActive(view.id);setError('');}}
          className={'min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold '+
            (active===view.id?'border-plasma-cyan/50 bg-plasma-cyan/15 text-plasma-cyan':'border-white/15 text-text-muted')}>
          {view.name}
        </button>)}
      </div>
      {active==='importance'&&<ImportancePanel importance={importance} job={job} onStart={measure} onCancel={cancel}/>}
      {active==='local'&&<div className="space-y-3">
        <label className="block max-w-sm text-xs font-semibold">Validation observation
          <select aria-label="F13 validation observation" value={rowId} className={inputClass}
            onChange={event=>{setRowId(event.target.value);setWhatIf(null);}}>
            {validRows.slice(0,80).map(row=><option key={row.id} value={row.id}>{row.id}</option>)}
          </select>
        </label>
        <LocalPanel explanation={local}/>
      </div>}
      {active==='dependence'&&<DependencePanel matrix={matrix} feature={feature}
        setFeature={value=>{setFeature(value);setPdp(null);setSubgroups(null);}}
        classIndex={classIndex} setClassIndex={value=>{setClassIndex(value);setPdp(null);}}
        result={pdp} onCalculate={calculate}/>}
      {active==='whatif'&&<div className="space-y-3">
        <label className="block max-w-sm text-xs font-semibold">Validation observation
          <select aria-label="F13 what-if observation" value={rowId} className={inputClass}
            onChange={event=>{setRowId(event.target.value);setWhatIf(null);}}>
            {validRows.slice(0,80).map(row=><option key={row.id} value={row.id}>{row.id}</option>)}
          </select>
        </label>
        <WhatIfPanel controls={controls} editFeature={editFeature} setEditFeature={value=>{setEditFeature(value);setWhatIf(null);}}
          editValue={editValue} setEditValue={setEditValue}
          sourceValue={rawRow?.[editFeature]} onRun={evaluateWhatIf} result={whatIf}/>
      </div>}
      {active==='subgroups'&&<SubgroupsPanel matrix={matrix} feature={feature}
        setFeature={value=>{setFeature(value);setPdp(null);setSubgroups(null);}}
        result={subgroups} onRun={inspectSubgroups}/>}
      {error&&<p role="alert" className="text-sm text-signal-amber">{error}</p>}
      {message&&<p role="status" className="text-sm text-quantum-mint">{message}</p>}
      <div className="rounded-xl border border-white/10 p-3 space-y-2">
        <h5 className="font-semibold">Reproducible explanation evidence</h5>
        <p className="text-xs text-text-muted">Exports method, selected candidate fingerprint, preparation lineage and aggregate results. No test rows are analyzed and no original source rows, individual identifiers, neighbor identities or model weights are included.</p>
        <ExportButton matrix={matrix} model={model} candidate={candidate} importance={importance}
          local={local} dependence={pdp} whatIf={whatIf} subgroups={subgroups}
          onError={setError} onMessage={setMessage}/>
      </div>
    </div>
  </details>;
}
