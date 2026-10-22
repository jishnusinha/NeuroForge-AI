import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createFeatureMatrix } from '../../../ml/modelWorkbench/featureMatrix.js';
import { MODEL_DEFINITIONS, fitWorkbenchModel, predictWorkbenchModel } from '../../../ml/modelWorkbench/models.js';
import { evaluateWorkbenchPredictions } from '../../../ml/modelWorkbench/metrics.js';
import ExplainabilityStudio from './ExplainabilityStudio.jsx';
import ModelVisualization from './ModelVisualization.jsx';
import ModelSelectionStudio from './ModelSelectionStudio.jsx';
import { createRunReceipt } from '../../../ml/modelRegistry/runContracts.js';
import { attachExplanationToRun } from '../../../ml/modelRegistry/runLifecycle.js';
import { saveF14Run } from '../../../services/modelRegistryRepository.js';
import { digest } from '../../../../../shared/domain.mjs';

const buttonClass='min-h-10 rounded-lg border border-white/20 bg-obsidian px-3 py-2 text-sm text-text-primary disabled:opacity-40';
const format=value=>value===null||value===undefined||!Number.isFinite(value)?'Unavailable':Number(value).toFixed(4);
const primaryMetric=task=>task==='regression'?'rmse':task==='binary_classification'?'f1':'macroF1';
const lowerIsBetter=task=>task==='regression';

function ScorePanel({ report }) {
  const labels=report.task==='regression'
    ?[['mae','MAE'],['mse','MSE'],['rmse','RMSE'],['r2','R²']]
    :[['accuracy','Accuracy'],['macroF1','Macro F1'],['weightedF1','Weighted F1'],
      ...(report.task==='binary_classification'?[['precision','Positive precision'],['recall','Positive recall'],['f1','Positive F1']]:[])];
  return <div className="space-y-3">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {labels.map(([key,label])=><div key={key} className="rounded-lg bg-surface-dark p-3">
        <dt className="text-xs text-text-muted">{label}</dt>
        <dd className="text-lg font-semibold tabular-nums">{format(report.metrics[key])}</dd>
      </div>)}
    </dl>
    {report.confusion&&<div role="region" aria-label={'F12 '+report.split+' confusion matrix'} tabIndex={0} className="overflow-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-xs">
        <caption className="p-2 text-left text-text-muted">Confusion matrix: true rows × predicted columns · {report.count} observations.</caption>
        <thead><tr><th scope="col" className="p-2">Actual / predicted</th>{report.perClass.map(item=><th key={String(item.name)} scope="col" className="p-2">{String(item.name)}</th>)}</tr></thead>
        <tbody>{report.confusion.map((row,i)=><tr key={i} className="border-t border-white/10">
          <th scope="row" className="p-2">{String(report.perClass[i].name)}</th>
          {row.map((count,j)=><td key={j} className="p-2 tabular-nums">{count}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="text-xs text-text-muted">{report.explanation}</p>
  </div>;
}

function PredictionTable({ report }) {
  return <div role="region" aria-label={'F12 '+report.split+' prediction evidence'} tabIndex={0}
    className="max-h-72 overflow-auto rounded-lg border border-white/10">
    <table className="w-full min-w-[420px] text-left text-xs">
      <caption className="p-2 text-left text-text-muted">First {Math.min(20,report.count)} of {report.count} scored {report.split} records; all records contribute to metrics.</caption>
      <thead className="sticky top-0 bg-surface-elevated"><tr><th scope="col" className="p-2">Source ID</th><th scope="col" className="p-2">Actual</th><th scope="col" className="p-2">Predicted</th><th scope="col" className="p-2">{report.task==='regression'?'Residual':'Outcome'}</th></tr></thead>
      <tbody>{report.evidence.slice(0,20).map(row=><tr key={row.id} className="border-t border-white/10">
        <th scope="row" className="p-2">{row.id}</th><td className="p-2">{String(row.target)}</td>
        <td className="p-2">{typeof row.predicted==='number'?format(row.predicted):String(row.predicted)}</td>
        <td className="p-2">{report.task==='regression'?format(row.residual):row.correct?'Correct':'Incorrect'}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function downloadSummary(summary) {
  const blob=new Blob([JSON.stringify(summary,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), anchor=document.createElement('a');
  anchor.href=url;anchor.download='neuroforge-f12-evidence.json';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ModelWorkbench({ plan }) {
  const matrix=useMemo(()=>createFeatureMatrix(plan),[plan]);
  const available=MODEL_DEFINITIONS.filter(model=>model.tasks.includes(matrix.task.type));
  const [modelId,setModelId]=useState(available[0]?.id??'baseline');
  const [lambda,setLambda]=useState(0.1);
  const [k,setK]=useState(5);
  const [epochs,setEpochs]=useState(180);
  const [maxDepth,setMaxDepth]=useState(4);
  const [minLeaf,setMinLeaf]=useState(3);
  const [trees,setTrees]=useState(12);
  const [candidates,setCandidates]=useState([]);
  const [selectedId,setSelectedId]=useState(null);
  const [testResult,setTestResult]=useState(null);
  const [savedByCandidate,setSavedByCandidate]=useState({});
  const [saveTitle,setSaveTitle]=useState('');
  const [saveArtifact,setSaveArtifact]=useState(false);
  const [saving,setSaving]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const algorithm=available.some(model=>model.id===modelId)?modelId:available[0]?.id;
  const selected=candidates.find(run=>run.id===selectedId)??candidates.at(-1);
  const scoreKey=primaryMetric(matrix.task.type);
  const options={lambda,k,epochs,maxDepth,minLeaf,trees,seed:42};
  const savedRun=selected?savedByCandidate[selected.id]??null:null;

  const acceptF15Selection=({algorithm:advancedAlgorithm,options:advancedOptions,selectionEvidence})=>{
    if(busy||testResult||candidates.length>=8)throw new Error('F15_CANDIDATE_SESSION_LOCKED');
    const trace=[];
    const fitted=fitWorkbenchModel(matrix,advancedAlgorithm,{...advancedOptions,onTrainingTrace:p=>trace.push(p)});
    const rows=matrix.rows.filter(row=>row.split==='validation');
    const validation=evaluateWorkbenchPredictions(matrix,
      predictWorkbenchModel(fitted,rows.map(row=>row.values)),'validation');
    const id='f15-'+Date.now()+'-'+candidates.length;
    setCandidates(previous=>[...previous,{id,algorithm:advancedAlgorithm,
      options:{...advancedOptions},model:fitted,validation,selectionEvidence,trainingTrace:trace.length?{points:trace}:null}]);
    setSelectedId(id);
    setMessage('F15 inner CV selection refitted on original training rows; fixed outer validation measured. Test remains sealed.');
    setError('');
  };

  const train=async()=>{
    if(busy||testResult)return;
    setBusy(true);setError('');setMessage('');
    // Yield a paint before bounded synchronous work; no dataset is sent to a server.
    await new Promise(resolve=>setTimeout(resolve,0));
    try {
      const trace=[];
      const fitted=fitWorkbenchModel(matrix,algorithm,{...options,onTrainingTrace:p=>trace.push(p)});
      const validationRows=matrix.rows.filter(row=>row.split==='validation');
      const predictions=predictWorkbenchModel(fitted,validationRows.map(row=>row.values));
      const validation=evaluateWorkbenchPredictions(matrix,predictions,'validation');
      const id='f12-'+Date.now()+'-'+candidates.length;
      const candidate={id,algorithm,options:{...options},model:fitted,validation,trainingTrace:trace.length?{points:trace}:null};
      setCandidates(previous=>[...previous,candidate].slice(-8));
      setSelectedId(id);
      setMessage('Training complete. Only validation predictions were evaluated; the test set remains sealed.');
    }catch(reason){setError(reason.message);}
    finally{setBusy(false);}
  };

  const finalEvaluate=async()=>{
    if(!selected||testResult||busy)return;
    setError('');
    try {
      const rows=matrix.rows.filter(row=>row.split==='test');
      const predictions=predictWorkbenchModel(selected.model,rows.map(row=>row.values));
      const report=evaluateWorkbenchPredictions(matrix,predictions,'test');
      const final={candidateId:selected.id,report,accessedAt:new Date().toISOString()};
      setTestResult(final);
      if(savedRun){
        try{
          const previous=savedRun.receipt;
          const refreshed=await createRunReceipt({
            matrix,plan,candidate:selected,finalTest:final,
            title:previous.title,tags:previous.tags,notes:previous.notes,
            includeArtifact:previous.model.storageMode==='opt_in_artifact',existing:previous,
          });
          const stored=await saveF14Run(refreshed,previous.revision);
          setSavedByCandidate(current=>({...current,[selected.id]:{receipt:stored}}));
          setMessage('Final test accessed once and its audit receipt updated in the local F14 archive. Further candidate tuning is frozen.');
        }catch(reason){
          setError('Final test was accessed, but its archive audit could not be saved: '+reason.message+
            '. Save the run again to preserve the access event.');
        }
      }else{
        setMessage('Final test accessed once. Save an F14 research receipt to preserve this audit after refresh. Candidate tuning is frozen.');
      }
    }catch(reason){setError(reason.message);}
  };

  const archiveRun=async()=>{
    if(!selected||saving)return;
    setSaving(true);setError('');setMessage('');
    try{
      const previous=savedRun?.receipt??null;
      const next=await createRunReceipt({
        matrix,plan,candidate:selected,finalTest:testResult,
        title:saveTitle.trim()||previous?.title||selected.algorithm+' F12 investigation',
        tags:previous?.tags??[],notes:previous?.notes??'',
        includeArtifact:['baseline','logistic','ridge'].includes(selected.algorithm)?saveArtifact:false,
        existing:previous,
      });
      const stored=await saveF14Run(next,previous?.revision??0);
      setSavedByCandidate(current=>({...current,[selected.id]:{receipt:stored}}));
      setMessage('Saved F14 run revision '+stored.revision+' locally. Open My Experiments to reopen and compare it.');
    }catch(reason){setError('F14 save failed: '+reason.message);}
    finally{setSaving(false);}
  };
  const attachF13=async(receipt)=>{
    const saved=savedByCandidate[selected?.id]?.receipt;
    if(!saved)throw new Error('Save this run in F14 before attaching F13 evidence.');
    const next=attachExplanationToRun(saved,receipt);
    const stored=await saveF14Run(next,saved.revision);
    setSavedByCandidate(current=>({...current,[selected.id]:{receipt:stored}}));
    setMessage('F13 explanation summary attached to the local F14 research run.');
  };

  const exportEvidence=async()=>{
    try {
      const receipt={
        kind:'neuroforge-f12-model-evidence',schemaVersion:1,createdAt:new Date().toISOString(),
        task:matrix.task,features:[...matrix.features],counts:Object.fromEntries(['train','validation','test'].map(split=>
          [split,matrix.rows.filter(row=>row.split===split).length])),
        pipelineDigest:await digest(matrix.lineage.fittedPipeline),
        splitSeed:matrix.lineage.splitSeed,splitPreset:matrix.lineage.splitPreset,
        candidates:candidates.map(item=>({
          algorithm:item.algorithm,options:item.options,trainingCount:item.model.trainingCount,
          validationMetrics:item.validation.metrics,validationCount:item.validation.count,
        })),
        finalTest:testResult?{candidateId:testResult.candidateId,
          accessedAt:testResult.accessedAt,metrics:testResult.report.metrics,count:testResult.report.count}:null,
        limitations:'Only observed split measurements. No original rows, fitted parameters, or training data included. Comparing candidates uses validation metrics; final test is accessed explicitly.',
      };
      downloadSummary(receipt);
      setMessage('Evidence summary exported without original observations or trained weights.');
    }catch(reason){setError(reason.message);}
  };

  return <details className="rounded-xl border border-plasma-cyan/30 bg-obsidian/70 p-3 sm:p-4">
    <summary className="cursor-pointer text-base font-semibold">F12 — Professional ML Workbench
      <span className="mt-1 block text-xs font-normal text-text-muted">Train real N-feature models using the prepared F11 matrix; inspect validation evidence and release final test once</span>
    </summary>
    <div role="region" aria-label="F12 Model Workbench" className="mt-4 space-y-4">
      <div className="prism-scope-bar" aria-label="Model investigation context"><strong>{selected?'Fitted candidate: '+selected.algorithm:'Configure a model'}</strong><span>Target: {matrix.task.targetColumn}</span><span>{matrix.features.length} prepared features</span><span>{matrix.membership.validation.length} fixed validation observations</span><span>{testResult?'Final test access recorded':'Final test protected'}</span></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Task',matrix.task.type.replaceAll('_',' ')],['Features',matrix.features.length],['Training',matrix.membership.train.length],['Validation',matrix.membership.validation.length]].map(([label,value])=>
          <div key={label} className="rounded-lg border border-white/10 bg-surface-dark p-3"><div className="text-xs text-text-muted">{label}</div><div className="font-semibold capitalize">{value}</div></div>)}
      </div>
      <p className="break-all text-xs text-text-muted">Every prepared input is used: {matrix.features.join(', ')}. Raw source records remain unchanged.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold">Algorithm
          <select aria-label="F12 algorithm" value={algorithm} disabled={busy||Boolean(testResult)}
            onChange={event=>setModelId(event.target.value)}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary">
            {available.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {['ridge','logistic','softmax'].includes(algorithm)&&<label className="text-xs font-semibold">L2 regularization
          <input aria-label="F12 regularization" type="number" min="0.000001" max="10" step="0.01" value={lambda}
            disabled={busy||Boolean(testResult)} onChange={event=>setLambda(Number(event.target.value))}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary"/>
        </label>}
        {algorithm==='knn'&&<label className="text-xs font-semibold">Neighbors (k)
          <input aria-label="F12 neighbors" type="number" min="1" max="25" step="1" value={k}
            disabled={busy||Boolean(testResult)} onChange={event=>setK(Number(event.target.value))}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary"/>
        </label>}
        {['logistic','softmax'].includes(algorithm)&&<label className="text-xs font-semibold">Training epochs
          <input aria-label="F12 epochs" type="number" min="20" max="400" step="10" value={epochs}
            disabled={busy||Boolean(testResult)} onChange={event=>setEpochs(Number(event.target.value))}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary"/>
        </label>}
        {['cart','forest'].includes(algorithm)&&<label className="text-xs font-semibold">Tree depth
          <input type="number" aria-label="F15 tree depth" value={maxDepth} min={1} max={7} step={1}
            disabled={busy||Boolean(testResult)} onChange={event=>setMaxDepth(Number(event.target.value))}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary"/>
        </label>}
        {['cart','forest'].includes(algorithm)&&<label className="text-xs font-semibold">Minimum leaf rows
          <input type="number" aria-label="F15 tree minimum leaf" value={minLeaf} min={2} max={30} step={1}
            disabled={busy||Boolean(testResult)} onChange={event=>setMinLeaf(Number(event.target.value))}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary"/>
        </label>}
        {algorithm==='forest'&&<label className="text-xs font-semibold">Forest trees
          <input type="number" aria-label="F15 forest trees" value={trees} min={3} max={30} step={1}
            disabled={busy||Boolean(testResult)} onChange={event=>setTrees(Number(event.target.value))}
            className="mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary"/>
        </label>}
      </div>
      <button type="button" onClick={train} disabled={busy||Boolean(testResult)||candidates.length>=8}
        className="min-h-11 rounded-lg bg-plasma-cyan px-4 text-sm font-semibold text-ink-on-accent disabled:opacity-40">
        {busy?'Training model…':'Train and evaluate validation'}
      </button>
      <ModelSelectionStudio plan={plan} matrix={matrix} onPromote={acceptF15Selection}
        disabled={busy||Boolean(testResult)||candidates.length>=8}/>
      {candidates.length>=8&&<p className="text-xs text-signal-amber">Eight-candidate browser session limit reached. Start a new preparation session for further experiments.</p>}
      <p className="text-xs text-text-muted">The held-out test set is not evaluated while training or selecting candidates. Validation measurements drive comparison. This session is browser-local.</p>

      {candidates.length>0&&<section aria-label="F12 model candidates" className="space-y-3">
        <h5 className="font-semibold">Candidate comparison · {scoreKey} on validation</h5>
        <div className="space-y-2">
          {candidates.map(item=><button key={item.id} type="button"
            disabled={Boolean(testResult)} onClick={()=>setSelectedId(item.id)}
            aria-pressed={selected?.id===item.id}
            className={'flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm disabled:opacity-75 '+
              (selected?.id===item.id?'border-plasma-cyan/50 bg-plasma-cyan/10':'border-white/10 bg-surface-dark')}>
            <span>{item.algorithm} · {item.model.trainingCount} training observations</span>
            <span className="font-semibold tabular-nums">{scoreKey}: {format(item.validation.metrics[scoreKey])}</span>
          </button>)}
        </div>
        <p className="text-xs text-text-muted">{lowerIsBetter(matrix.task.type)?'Lower validation RMSE is better.':'Higher validation F1 is better.'} Compare only candidates sharing this frozen dataset and split.</p>
      </section>}
      {selected&&<section aria-label="F12 validation results" className="space-y-3">
        <h5 className="font-semibold">Validation results · {selected.algorithm}</h5>
        <ScorePanel report={selected.validation}/>
        <PredictionTable report={selected.validation}/>
      </section>}
      {selected&&<ModelVisualization key={'f19-'+selected.id} matrix={matrix} candidate={selected}/>}
      {selected&&<section aria-label="F14 save research run" className="space-y-3 rounded-xl border border-plasma-cyan/30 bg-surface-dark p-3">
        <h5 className="font-semibold">F14 — Preserve this research run</h5>
        <p className="text-xs text-text-muted">Save validation metrics, fingerprints and any recorded final-test access locally. Raw rows and per-row prediction records are never stored. This is a research receipt, not automatic model deployment.</p>
        <label className="block max-w-lg text-xs font-semibold">Experiment title
          <input aria-label="F14 experiment title" maxLength={100} value={saveTitle}
            placeholder={savedRun?.receipt.title??selected.algorithm+' F12 investigation'}
            onChange={event=>setSaveTitle(event.target.value)}
            className="mt-1 min-h-10 w-full rounded-lg border border-white/20 bg-obsidian p-2 text-sm text-text-primary"/>
        </label>
        <label className="flex items-start gap-2 text-xs text-text-muted">
          <input type="checkbox" aria-label="F14 opt-in fitted artifact" checked={saveArtifact}
            disabled={!['baseline','logistic','ridge'].includes(selected.algorithm)} onChange={event=>setSaveArtifact(event.target.checked)}/>
          <span>Opt in to saving fitted model parameters for prepared-vector inference replay (baseline, logistic and ridge only). Training statistics may be sensitive. F15 tree/forest/softmax and kNN models are receipt-only until artifact validators are implemented.</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={saving} onClick={archiveRun} className={buttonClass}>
            {saving?'Saving locally…':savedRun?'Update saved F14 run':'Save F14 research run'}
          </button>
          <Link to="/app/experiments" className="min-h-10 rounded-lg border border-plasma-cyan/25 px-3 py-2 text-sm text-plasma-cyan">Open My Experiments archive</Link>
        </div>
        {savedRun&&<p role="status" className="text-xs text-quantum-mint">
          Local F14 receipt saved · revision {savedRun.receipt.revision} · {savedRun.receipt.model.storageMode==='opt_in_artifact'?'opt-in replay artifact':'receipt only'}.
        </p>}
      </section>}
      {selected&&<ExplainabilityStudio key={selected.id} matrix={matrix} candidate={selected} plan={plan}
        onArchive={savedRun?attachF13:null}/>}
      {selected&&!testResult&&<div className="rounded-xl border border-signal-amber/30 bg-surface-dark p-3 space-y-2">
        <h5 className="font-semibold">Protected final test</h5>
        <p className="text-xs text-text-muted">Finalize candidate selection before evaluating the {matrix.membership.test.length} held-out test records. This action reveals test metrics and freezes further model tuning in this session.</p>
        <button type="button" onClick={finalEvaluate} disabled={busy} className={buttonClass}>Evaluate selected model on held-out test once</button>
      </div>}
      {testResult&&<section aria-label="F12 final test results" className="rounded-xl border border-quantum-mint/40 bg-surface-dark p-3 space-y-3">
        <h5 className="font-semibold text-quantum-mint">Final held-out test · {selected?.algorithm}</h5>
        <p className="text-xs text-text-muted">Test accessed at {testResult.accessedAt}. This is the single recorded final evaluation for the selected candidate.</p>
        <ScorePanel report={testResult.report}/>
        <PredictionTable report={testResult.report}/>
        <ModelVisualization key={'f19-final-'+selected.id} matrix={matrix} candidate={selected} finalTest={testResult}/>
      </section>}
      <button type="button" onClick={exportEvidence} disabled={!candidates.length} className={buttonClass}>
        Export F12 evidence JSON
      </button>
      {message&&<p role="status" className="text-sm text-quantum-mint">{message}</p>}
      {error&&<p role="alert" className="text-sm text-signal-amber">{error}</p>}
      <p className="text-xs text-text-muted">Standard F12 evidence exports contain only metadata and measured metrics. F14 can store a research receipt locally; fitted model parameters are saved only with explicit opt-in, never for kNN. Full source-data restoration and N-dimensional Arena integration remain future work.</p>
    </div>
  </details>;
}
