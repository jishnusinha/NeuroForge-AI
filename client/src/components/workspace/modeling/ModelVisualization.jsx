import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {createModelChartSpec} from '../../../visualization/modelChartSpec.js';
import {MODEL_CHARTS} from '../../../visualization/chartRegistry.js';
import CodeCompanionEntry from '../../../design/components/CodeCompanionEntry.jsx';
const ScientificChart=lazy(()=>import('../charts/ScientificChart.jsx'));
const regressionTypes=['actual_predicted','residuals','residual_distribution','error_range'];
export function ModelChart({matrix,candidate,type,config={},report,finalTest,explanation}){
  const [state,setState]=useState({result:null,error:''});
  const [linked,setLinked]=useState({request:null,ids:[]});
  // Serialized controls provide stable request dependencies without retaining results
  // across candidate, report, or explanation changes.
  const configKey=JSON.stringify({...config,type});
  const request=useMemo(()=>({matrix,candidate,config:JSON.parse(configKey),report,finalTest,explanation}),[matrix,candidate,configKey,report,finalTest,explanation]);
  useEffect(()=>{
    let cancelled=false;
    createModelChartSpec(request).then(result=>{if(!cancelled)setState({request,result,error:''});}).catch(e=>{if(!cancelled)setState({request,result:null,error:e.message});});
    return ()=>{cancelled=true;};
  },[request]);
  if(state.request!==request)return <p role="status">Preparing measured F19 evidence…</p>;
  if(state.error)return <p role="alert">{state.error}</p>;
  const linkedRows=linked.request===request?(report||candidate.validation).evidence.filter(r=>linked.ids.includes(r.id)):[];
  return state.result?<><Suspense fallback={<p role="status">Loading PRISM renderer…</p>}><ScientificChart key={state.result.spec.chartId} result={state.result} onLink={ids=>setLinked({request,ids})}/></Suspense>
    {linkedRows.length>0&&<div role="region" aria-label="F19 linked prediction records" tabIndex={0} className="prism-table-scroll"><table className="prism-data-table"><caption>{linkedRows.length} linked recorded predictions (first 100 shown; session only)</caption><thead><tr><th>Source ID</th><th>Actual</th><th>Predicted</th><th>Residual / outcome</th></tr></thead><tbody>{linkedRows.slice(0,100).map(r=><tr key={r.id}><th>{r.id}</th><td>{String(r.target)}</td><td>{String(r.predicted)}</td><td>{r.residual??(r.correct?'Correct':'Incorrect')}</td></tr>)}</tbody></table></div>}</>:null;
}
export default function ModelVisualization({matrix,candidate,finalTest=null}){
  const [open,setOpen]=useState(false),[type,setType]=useState(matrix.task.type==='regression'?'actual_predicted':'confusion'),[classIndex,setClassIndex]=useState(matrix.task.classes.length-1),[normalized,setNormalized]=useState(false);
  const report=finalTest?.report||candidate.validation;
  const definitions=MODEL_CHARTS.filter(d=>d.id==='training_loss'?!!candidate.trainingTrace&&!finalTest:regressionTypes.includes(d.id)===(matrix.task.type==='regression'));
  return <details className="prism-chart-card" onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer p-3 font-semibold">F19 — Model Evaluation Studio{finalTest?' · Final held-out test':' · Validation'}</summary>
    {open&&<section className="p-3 space-y-3" aria-label="F19 Model Evaluation Studio">
      <p className="prism-chart-caption">Selected candidate: {candidate.algorithm}. {finalTest?'Final results already accessed through F12. Avoid further tuning.':'Recorded validation measurements; opening charts never evaluates the held-out test.'} Chart sessions are temporary and are not restored from F14 receipts.</p>
      <div className="prism-sheet-tools">
        <label>Evaluation view<select aria-label="F19 evaluation view" value={type} onChange={e=>setType(e.target.value)}>{definitions.map(d=><option value={d.id} key={d.id}>{d.label}</option>)}</select></label>
        {['roc','precision_recall','calibration'].includes(type)&&<label>One-vs-rest class<select aria-label="F19 probability class" value={classIndex} onChange={e=>setClassIndex(Number(e.target.value))}>{matrix.task.classes.map((name,i)=><option key={i} value={i}>{String(name)}</option>)}</select></label>}
        {type==='confusion'&&<label><input type="checkbox" aria-label="F19 normalize true class rows" checked={normalized} onChange={e=>setNormalized(e.target.checked)}/> Normalize by true class support</label>}
      </div>
      <ModelChart matrix={matrix} candidate={candidate} report={report} finalTest={finalTest} type={type} config={{classIndex:matrix.task.type==='regression'?undefined:classIndex,rowNormalized:normalized}}/>
      <CodeCompanionEntry summary="F22 — Model example code (separate from plotted evidence)" context={{...candidate.options,workspace:'workbench',algorithm:candidate.algorithm,task:matrix.task.type,features:matrix.features.length,classCount:matrix.task.classes.length||2,seed:candidate.options?.seed??42}}/>
    </section>}
  </details>;
}
