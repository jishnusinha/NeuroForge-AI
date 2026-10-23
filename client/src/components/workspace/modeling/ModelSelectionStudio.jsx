import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MODEL_DEFINITIONS } from '../../../ml/modelWorkbench/models.js';
import { F15_GRID } from '../../../ml/modelSelection/searchManifest.js';
import CodeCompanionEntry from '../../../design/components/CodeCompanionEntry.jsx';
const SearchVisualization=lazy(()=>import('../charts/SearchVisualization.jsx'));

const control='mt-1 min-h-10 w-full rounded-lg border border-white/20 bg-surface-dark px-2 py-2 text-sm text-text-primary';
const action='min-h-10 rounded-lg border border-white/20 bg-obsidian px-3 py-2 text-sm text-text-primary disabled:opacity-40';
const show=value=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(5):'Unavailable';
const metricOptions=task=>task==='regression'?['rmse','mae','r2']:['accuracy','macroF1'];

export default function ModelSelectionStudio({ plan, matrix, onPromote, disabled=false }) {
  const available=MODEL_DEFINITIONS.filter(def=>def.tasks.includes(matrix.task.type));
  const [algorithm,setAlgorithm]=useState('cart');
  const [folds,setFolds]=useState(3);
  const [metric,setMetric]=useState(metricOptions(matrix.task.type)[0]);
  const [search,setSearch]=useState(null);
  const [partial,setPartial]=useState(null);
  const [progress,setProgress]=useState({completed:0,total:0});
  const [running,setRunning]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [selectedIndex,setSelectedIndex]=useState(null);
  const workerRef=useRef(null);
  const requestRef=useRef(0);
  useEffect(()=>()=>{workerRef.current?.terminate();},[]);
  const chosen=available.some(def=>def.id===algorithm)?algorithm:available[0].id;
  const cancel=()=>{
    if(workerRef.current){workerRef.current.terminate();workerRef.current=null;}
    requestRef.current++;
    setPartial(null);
    setRunning(false);
    setMessage('Search cancelled. Incomplete trials were not treated as valid model-selection evidence.');
  };
  const start=()=>{
    if(disabled||running)return;
    if(workerRef.current)workerRef.current.terminate();
    setRunning(true);setSearch(null);setPartial(null);setSelectedIndex(null);setError('');setMessage('');
    setProgress({completed:0,total:F15_GRID[chosen].length*folds});
    const worker=new Worker(new URL('../../../ml/modelSelection/searchWorker.js',import.meta.url),{type:'module'});
    const id=++requestRef.current;
    workerRef.current=worker;
    worker.onmessage=event=>{
      if(workerRef.current!==worker||event.data?.requestId!==id)return;
      if(event.data.type==='progress'){setPartial(event.data.progress.snapshot??null);setProgress({
        completed:event.data.progress.completed,total:event.data.progress.total,
      });}
      else{
        worker.terminate();workerRef.current=null;setRunning(false);
        if(event.data.type==='result'){
          setSearch(event.data.result);
          setSelectedIndex(event.data.result.selectedIndex);
          setMessage('Inner cross-validation completed. The fixed outer validation and test partitions were not included.');
        }else setError(event.data.message??'F15 search failed.');
      }
    };
    worker.onerror=()=>{
      if(workerRef.current!==worker)return;
      worker.terminate();workerRef.current=null;setRunning(false);
      setError('F15 cross-validation worker could not run.');
    };
    // Only RAW original-training rows are sent to the worker. Even the outer
    // validation/test labels are absent from its data payload.
    const training=new Set(matrix.membership.train);
    const safePlan={recipe:structuredClone(plan.recipe),
      raw:plan.raw.filter(row=>training.has(row.id)).map(row=>({...row}))};
    const safeMatrix={task:structuredClone(matrix.task),membership:{
      train:[...matrix.membership.train],validation:[],test:[]}};
    worker.postMessage({requestId:id,plan:safePlan,matrix:safeMatrix,
      request:{algorithm:chosen,folds,metric,seed:42}});
  };
  const promote=()=>{
    if(!search||selectedIndex===null||disabled)return;
    const selected=search.results.find(item=>item.configIndex===selectedIndex&&item.status==='complete');
    if(!selected){setError('Choose a fully evaluated configuration.');return;}
    try {
      onPromote({
        algorithm:search.algorithm,options:{...selected.configuration},
        selectionEvidence:{
          kind:'neuroforge-f15-selection',schemaVersion:1,
          scope:'original-training-inner-cv',algorithm:search.algorithm,task:search.task,
          metric:search.metric,direction:search.direction,folds:search.folds,
          seed:search.seed,foldMembershipDigest:search.foldMembershipDigest,
          sourceTrainingCount:search.sourceTrainingCount,
          selectedIndex:selected.configIndex,selectedMean:selected.mean,
          selectedSampleSd:selected.sampleSd,
          trials:search.results.map(item=>({
            configIndex:item.configIndex,configuration:item.configuration,
            status:item.status,foldScores:item.foldScores,foldCounts:item.foldCounts,
            mean:item.mean,sampleSd:item.sampleSd,reason:item.reason,
          })),
        },
      });
      setMessage('Selected configuration sent to F12 for a fresh training-only refit and fixed validation evaluation.');
    }catch(reason){setError(reason.message);}
  };
  return <details className="rounded-xl border border-plasma-cyan/30 bg-surface-dark p-3 sm:p-4">
    <summary className="cursor-pointer text-base font-semibold">
      F15 — Advanced Model Selection
      <span className="mt-1 block text-xs font-normal text-text-muted">
        Train fold-safe F11 preprocessing and N-feature models within the original training partition. Compare inner-CV scores without touching held-out labels.
      </span>
    </summary>
    <section role="region" aria-label="F15 Model Selection Studio" className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold">Search algorithm
          <select aria-label="F15 search algorithm" className={control} value={chosen}
            disabled={running||disabled} onChange={event=>{setAlgorithm(event.target.value);setSearch(null);setSelectedIndex(null);}}>
            {available.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Inner CV folds
          <select aria-label="F15 fold count" className={control} value={folds}
            disabled={running||disabled} onChange={event=>{setFolds(Number(event.target.value));setSearch(null);setSelectedIndex(null);}}>
            <option value={3}>3 folds</option><option value={5}>5 folds</option>
          </select>
        </label>
        <label className="text-xs font-semibold">Selection metric
          <select aria-label="F15 selection metric" className={control} value={metric}
            disabled={running||disabled} onChange={event=>{setMetric(event.target.value);setSearch(null);setSelectedIndex(null);}}>
            {metricOptions(matrix.task.type).map(item=><option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-text-muted">{F15_GRID[chosen].length} preset configurations × {folds} inner folds = {F15_GRID[chosen].length*folds} model fits. The maximum supported search is 60 fits. F11 transformations are refitted separately on each fold's training records.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={start} disabled={running||disabled}
          className="min-h-11 rounded-lg bg-plasma-cyan px-4 py-2 text-sm font-semibold text-ink-on-accent disabled:opacity-40">
          {running?'Evaluating inner CV…':'Run F15 cross-validation search'}
        </button>
        {running&&<button type="button" onClick={cancel} className={action}>Cancel F15 search</button>}
      </div>
      {running&&<p role="status" className="text-xs text-text-muted">Completed {progress.completed} of {progress.total} inner-fold fits. Worker can be cancelled.</p>}
      {(search||running&&partial)&&<Suspense fallback={<p>Loading search analytics…</p>}><SearchVisualization search={search||partial} onSelect={setSelectedIndex} disabled={running||disabled}/></Suspense>}
      {search&&<section aria-label="F15 cross-validation results" className="space-y-3">
        <h5 className="font-semibold">Inner CV leaderboard · {search.metric} ({search.direction})</h5>
        <p className="text-xs text-text-muted">{search.sourceTrainingCount} original training observations · {search.folds} folds · seed {search.seed} · fold digest {search.foldMembershipDigest.slice(0,16)}…</p>
        <div role="region" aria-label="F15 fold score table" tabIndex={0}
          className="max-h-80 overflow-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[510px] text-left text-xs">
            <caption className="p-2 text-left text-text-muted">Mean and sample standard deviation summarize inner fold variation; these are not confidence intervals.</caption>
            <thead><tr><th scope="col" className="p-2">Select</th><th scope="col" className="p-2">Hyperparameters</th>
              <th scope="col" className="p-2">Mean</th><th scope="col" className="p-2">Fold SD</th>
              <th scope="col" className="p-2">Scores / status</th></tr></thead>
            <tbody>{search.results.map(item=><tr key={item.configIndex} className="border-t border-white/10">
              <td className="p-2"><input type="radio" name="f15-candidate" aria-label={'F15 configuration '+(item.configIndex+1)}
                checked={selectedIndex===item.configIndex} disabled={item.status!=='complete'||disabled}
                onChange={()=>setSelectedIndex(item.configIndex)}/></td>
              <th scope="row" className="p-2 font-medium">{Object.entries(item.configuration).map(([key,value])=>key+': '+value).join(', ')||'Training-only baseline'}</th>
              <td className="p-2 tabular-nums">{show(item.mean)}</td><td className="p-2 tabular-nums">{show(item.sampleSd)}</td>
              <td className="p-2 tabular-nums">{item.status==='complete'?item.foldScores.map(show).join(' / '):item.reason}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <button type="button" onClick={promote} disabled={disabled||selectedIndex===null} className={action}>
          Train selected configuration on original training split
        </button>
        {search.limitations.map(line=><p key={line} className="text-xs text-text-muted">{line}</p>)}
      </section>}
      {error&&<p role="alert" className="text-sm text-signal-amber">{error}</p>}
      {message&&<p role="status" className="text-sm text-quantum-mint">{message}</p>}
      <p className="text-xs text-text-muted">Search configurations are predefined, bounded and executed locally in a cancellable worker. Final validation and test remain separate. Selecting a candidate does not reveal test scores.</p>
      <CodeCompanionEntry summary="F22 — Fold-safe search code" search={{workspace:'workbench',algorithm:chosen,task:matrix.task.type,features:matrix.features.length,classCount:matrix.task.classes.length||2,folds,metric,seed:42}}/>
    </section>
  </details>;
}
