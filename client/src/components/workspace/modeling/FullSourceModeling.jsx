import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useSourceEdits} from '../../../services/useSourceEdits.js';
import {createFullSourceSession} from '../../../ml/fullSourceSession.js';
import {createFullSourceReceipt} from '../../../ml/modelRegistry/fullSourceReceipt.js';
import {saveF14Run} from '../../../services/modelRegistryRepository.js';

const control='mt-1 block min-h-10 w-full rounded-lg border border-white/20 bg-surface-dark p-2 text-sm text-text-primary';
const score=value=>Number.isFinite(value)?Number(value.toFixed(6)).toLocaleString():'Unavailable';
function Measurements({report}) {
  return <section aria-label={'Full-source '+report.split+' results'} className="space-y-3 rounded-xl border border-white/15 p-3">
    <h5 className="font-semibold capitalize">{report.split} · {report.count.toLocaleString()} scored rows</h5>
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(report.metrics).map(([name,value])=><div key={name} className="rounded-lg bg-surface-dark p-2"><dt className="text-xs uppercase text-text-muted">{name}</dt><dd className="font-semibold tabular-nums">{score(value)}</dd></div>)}</dl>
    {report.confusion&&<div className="overflow-auto" role="region" aria-label={report.split+' full-source confusion matrix'} tabIndex={0}><table className="w-full text-left text-xs"><caption className="p-2 text-left">True class rows × predicted class columns</caption><thead><tr><th scope="col" className="p-2">Actual / predicted</th>{report.perClass.map(item=><th key={JSON.stringify(item.name)} scope="col" className="p-2">{String(item.name)}</th>)}</tr></thead><tbody>{report.confusion.map((row,i)=><tr key={i}><th scope="row" className="p-2">{String(report.perClass[i].name)}</th>{row.map((count,j)=><td key={j} className="p-2">{count.toLocaleString()}</td>)}</tr>)}</tbody></table></div>}
    <details><summary className="cursor-pointer text-sm">Prediction preview</summary><div className="overflow-auto"><table className="w-full text-left text-xs"><caption className="p-2 text-left">First {report.evidence.length} predictions; all {report.count.toLocaleString()} rows contribute to these metrics.</caption><thead><tr>{['Source ID','Actual','Predicted'].map(name=><th key={name} scope="col" className="p-2">{name}</th>)}</tr></thead><tbody>{report.evidence.map(row=><tr key={row.id}><th scope="row" className="p-2">{row.id}</th><td className="p-2">{String(row.target)}</td><td className="p-2">{typeof row.predicted==='number'?score(row.predicted):String(row.predicted)}</td></tr>)}</tbody></table></div></details>
    <p className="text-xs text-text-muted">Undefined metric denominators are reported as unavailable. Metrics are accumulated over this complete held-out partition.</p>
  </section>;
}

export default function FullSourceModeling({dataset}) {
  const {sourceFile:file,sourceSummary:summary,sourceOptions:options}=dataset;
  const numeric=summary.profile.filter(column=>column.type==='numeric').map(column=>column.name);
  const [target,setTarget]=useState(()=>summary.headers.find(name=>/^(target|label|class|outcome)$/i.test(name))??summary.headers.at(-1));
  const [features,setFeatures]=useState(()=>numeric.filter(name=>name!==(summary.headers.find(name=>/^(target|label|class|outcome)$/i.test(name))??summary.headers.at(-1))).slice(0,2));
  const [task,setTask]=useState('binary_classification'),[algorithm,setAlgorithm]=useState('logistic'),[seed,setSeed]=useState(42),[splitPreset,setSplitPreset]=useState('70/15/15'),[lambda,setLambda]=useState(.1),[epochs,setEpochs]=useState(20);
  const [result,setResult]=useState(null),[finalTest,setFinalTest]=useState(null),[testAccessed,setTestAccessed]=useState(false),[fittedRevision,setFittedRevision]=useState(null);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [title,setTitle]=useState('Full-source experiment'),[includeArtifact,setIncludeArtifact]=useState(false),[saved,setSaved]=useState(null),[saving,setSaving]=useState(false);
  const {edits,revision,error:overlayError}=useSourceEdits(summary);
  const session=useRef(null),generation=useRef(0);
  useEffect(()=>()=>{generation.current++;session.current?.close();},[file]);
  const reset=()=>{generation.current++;session.current?.close();session.current=null;setBusy(false);setProgress(null);setResult(null);setFinalTest(null);setTestAccessed(false);setSaved(null);setMessage('');setError('');};
  const train=async()=>{
    if(busy||result||overlayError)return;
    const token=++generation.current;setBusy(true);setError('');setMessage('');setProgress(null);
    session.current?.close();
    try {
      session.current=createFullSourceSession(file,options,edits);
      const fitted=await session.current.fit({features,targetColumn:target,task,algorithm,seed,splitPreset,lambda,epochs},{onProgress:p=>{if(token===generation.current)setProgress(p);}});
      if(token!==generation.current)return;
      setResult(fitted);setFittedRevision(revision);setMessage('Full-source fitting complete. Validation was scored; test predictions remain sealed.');
    }catch(reason){if(token===generation.current){if(reason.name!=='AbortError')setError(reason.message);session.current?.close();}}
    finally{if(token===generation.current){setBusy(false);setProgress(null);}}
  };
  const evaluateTest=async()=>{
    if(!result||busy||testAccessed)return;
    const token=generation.current;setTestAccessed(true);setBusy(true);setError('');setMessage('');
    try{
      const measured=await session.current.evaluateTest({onProgress:p=>{if(token===generation.current)setProgress(p);}});
      if(token!==generation.current)return;
      setFinalTest(measured);setMessage('Final test evaluated once. Further fitting is frozen in this investigation.');
      if(saved){
        try{const receipt=await createFullSourceReceipt(result,{title:saved.title,finalTest:measured,includeArtifact:saved.model.storageMode==='opt_in_artifact',existing:saved});const stored=await saveF14Run(receipt,saved.revision);if(token===generation.current)setSaved(stored);}
        catch(reason){if(token===generation.current)setError('Final test was evaluated, but its archive update failed: '+reason.message+'. Save the experiment again to preserve this access event.');}
      }
    }catch(reason){if(token===generation.current)setError('Final-test access was attempted and is locked for this investigation: '+reason.message);}
    finally{if(token===generation.current){setBusy(false);setProgress(null);}}
  };
  const save=async()=>{
    if(!result||saving||busy)return;
    setSaving(true);setError('');const token=generation.current;
    try{const receipt=await createFullSourceReceipt(result,{title,finalTest,includeArtifact,existing:saved});const stored=await saveF14Run(receipt,saved?.revision??0);if(token===generation.current){setSaved(stored);setMessage('Full-source experiment saved to My Experiments.');}}
    catch(reason){if(token===generation.current)setError(reason.message);}
    finally{if(token===generation.current)setSaving(false);}
  };
  const exportEvidence=async()=>{
    try{
      const receipt=await createFullSourceReceipt(result,{title,finalTest,includeArtifact:false});
      const blob=new Blob([JSON.stringify(receipt,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='neuroforge-full-source-evidence.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(reason){setError(reason.message);}
  };
  const locked=busy||Boolean(result)||saving;
  return <section aria-label="Full-source model fitting" className="space-y-4 rounded-xl border border-plasma-cyan/30 bg-obsidian p-3 sm:p-4">
    <div><h4 className="text-lg font-semibold">Fit models on the full source</h4><p className="mt-1 text-xs text-text-muted">{summary.sourceRows.toLocaleString()} source rows · {Object.keys(edits).length.toLocaleString()} edited cells · processed locally in a cancellable Worker. Every row enters one fixed training, validation or test partition.</p></div>
    <p className="text-xs text-text-muted">Full-source fitting supports baseline models, ridge regression and binary logistic regression with 1–20 numeric inputs. Missing inputs use training means; scaling is fitted on the training partition. The visual pipeline and model labs continue to use an explicit sample capped at 2,000 rows. Custom recipes, trees, forests and kNN use those sampled labs.</p>
    <fieldset disabled={locked} className="space-y-3 disabled:opacity-70"><legend className="sr-only">Full-source model configuration</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs">Target<select aria-label="Full-source target" className={control} value={target} onChange={event=>{setTarget(event.target.value);setFeatures(previous=>previous.filter(name=>name!==event.target.value));}}>{summary.headers.map(name=><option key={name}>{name}</option>)}</select></label>
        <label className="text-xs">Task<select aria-label="Full-source task" className={control} value={task} onChange={event=>{const next=event.target.value;setTask(next);setAlgorithm(next==='regression'?'ridge':next==='binary_classification'?'logistic':'baseline');}}><option value="binary_classification">Binary classification</option><option value="multiclass_classification">Multiclass classification</option><option value="regression">Regression</option></select></label>
        <label className="text-xs">Algorithm<select aria-label="Full-source algorithm" className={control} value={algorithm} onChange={event=>setAlgorithm(event.target.value)}><option value="baseline">Training-only baseline</option>{task==='regression'&&<option value="ridge">Ridge regression</option>}{task==='binary_classification'&&<option value="logistic">Logistic regression</option>}</select></label>
      </div>
      <fieldset className="rounded-lg border border-white/15 p-3"><legend className="px-1 text-xs">Numeric features · {features.length} of 20 selected</legend><div className="flex max-h-52 flex-wrap gap-x-5 gap-y-3 overflow-auto">{numeric.filter(name=>name!==target).map(name=><label key={name} className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={'Full-source feature '+name} checked={features.includes(name)} disabled={!features.includes(name)&&features.length>=20} onChange={event=>setFeatures(previous=>event.target.checked?[...previous,name]:previous.filter(value=>value!==name))}/>{name}</label>)}{!numeric.filter(name=>name!==target).length&&<p className="text-xs">No numeric input columns are available.</p>}</div></fieldset>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs">Train / validation / test<select aria-label="Full-source split" className={control} value={splitPreset} onChange={event=>setSplitPreset(event.target.value)}>{['70/15/15','80/10/10','60/20/20'].map(preset=><option key={preset}>{preset}</option>)}</select></label>
        <label className="text-xs">Split seed<input aria-label="Full-source seed" className={control} type="number" min="0" max="4294967295" step="1" value={seed} onChange={event=>setSeed(Number(event.target.value))}/></label>
        {algorithm!=='baseline'&&<label className="text-xs">L2 regularization<input aria-label="Full-source regularization" className={control} type="number" min="0.000001" max="10" step="0.01" value={lambda} onChange={event=>setLambda(Number(event.target.value))}/></label>}
        {algorithm==='logistic'&&<label className="text-xs">Full training passes<input aria-label="Full-source epochs" className={control} type="number" min="1" max="400" step="1" value={epochs} onChange={event=>setEpochs(Number(event.target.value))}/></label>}
      </div>
    </fieldset>
    <p className="text-xs text-text-muted">Classification is split exactly within each class using a seeded affine permutation of source order. Each class requires at least three rows. Regression uses the same permutation over all rows. Logistic regression reads the complete training partition each epoch with full-batch gradients (learning rate 0.25). Large files and more epochs take longer.</p>
    {!result&&<button type="button" className="prism-ui-button" disabled={busy||!features.length||Boolean(overlayError)} onClick={train}>Fit full source and score validation</button>}
    {(busy||result)&&<button type="button" className="prism-ui-button" disabled={saving} onClick={reset}>{busy?'Cancel full-source execution':'Start new full-source investigation'}</button>}
    {progress&&<div role="status" className="space-y-2 text-xs"><p>{progress.phase}{progress.epoch?` · epoch ${progress.epoch} of ${progress.epochs}`:''} · {Math.round(progress.bytes/Math.max(1,progress.totalBytes)*100)}%</p><progress className="w-full" max={progress.totalBytes||1} value={progress.bytes||0}/></div>}
    {result&&<>
      <dl className="grid grid-cols-3 gap-2">{Object.entries(result.counts).map(([name,count])=><div key={name} className="rounded-lg bg-surface-dark p-3"><dt className="text-xs capitalize text-text-muted">{name}</dt><dd className="font-semibold">{count.toLocaleString()}</dd></div>)}</dl>
      <p className="break-all text-xs text-text-muted">Fitted source digest: {result.sourceDigest} · {result.editedCells} edited cells in the frozen source version.</p>
      {revision!==fittedRevision&&<p role="status" className="text-xs text-signal-amber">Source edits have changed since this fit. These results and test evaluation remain bound to the frozen edit snapshot. Start a new investigation to fit the latest edits.</p>}
      <details><summary className="cursor-pointer text-sm">Training-fitted preprocessing</summary><div className="overflow-auto"><table className="w-full text-left text-xs"><caption className="p-2 text-left">Training means impute missing inputs in every partition; no held-out feature statistics are fitted.</caption><thead><tr>{['Feature','Observed training','Missing training','Mean','Scale'].map(name=><th key={name} scope="col" className="p-2">{name}</th>)}</tr></thead><tbody>{result.pipeline.statistics.map(item=><tr key={item.feature}><th scope="row" className="p-2">{item.feature}</th>{[item.observed,item.missing,item.mean,item.scale].map((value,i)=><td key={i} className="p-2">{score(value)}</td>)}</tr>)}</tbody></table></div></details>
      <Measurements report={result.validation}/>
      {!testAccessed&&<button type="button" className="prism-ui-button" disabled={busy||saving} onClick={evaluateTest}>Evaluate full-source held-out test once</button>}
      {testAccessed&&<p className="text-xs text-text-muted">Final-test access is locked for this investigation{finalTest?` · accessed ${finalTest.accessedAt}`:'.'}</p>}
      {finalTest&&<Measurements report={finalTest.report}/>}
      <div className="space-y-3 rounded-lg border border-white/15 p-3">
        <label className="block text-xs">Experiment title<input aria-label="Full-source experiment title" className={control} maxLength="100" value={title} onChange={event=>setTitle(event.target.value)}/></label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" aria-label="Full-source save fitted artifact" checked={includeArtifact} onChange={event=>setIncludeArtifact(event.target.checked)}/>Opt in to storing fitted model parameters and training statistics for numeric-input inference replay. Source rows and per-row predictions are excluded.</label>
        <div className="flex flex-wrap gap-2"><button type="button" className="prism-ui-button" disabled={busy||saving||!title.trim()} onClick={save}>{saving?'Saving experiment…':saved?'Update full-source experiment':'Save full-source experiment'}</button><button type="button" className="prism-ui-button" disabled={busy||saving} onClick={exportEvidence}>Export full-source evidence JSON</button><Link className="prism-ui-button" to="/app/experiments">Open My Experiments</Link></div>
        {saved&&<p role="status" className="text-xs">Saved  receipt · revision {saved.revision} · {saved.model.storageMode==='opt_in_artifact'?'Fitted parameters included':'Metrics and provenance only'}.</p>}
      </div>
    </>}
    {message&&<p role="status" className="text-sm text-quantum-mint">{message}</p>}
    {(error||overlayError)&&<p role="alert" className="text-sm text-signal-amber">{error||overlayError}</p>}
  </section>;
}
