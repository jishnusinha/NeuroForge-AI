import {useEffect,useMemo,useRef,useState} from 'react';
import {digest} from '../../../../../shared/domain.mjs';
import {CHART_REGISTRY} from '../../../visualization/chartRegistry.js';
import {createChartSpec,validateChartConfig} from '../../../visualization/chartSpecV2.js';
import {validatedSelection} from '../../../visualization/linkedSelection.js';
import {datasetOwner} from '../../../services/datasetVersionRepository.js';
import {listChartConfigs,saveChartConfig,deleteChartConfig} from '../../../services/chartConfigRepository.js';
import ScientificChart from './ScientificChart.jsx';

export default function ChartStudio({dataset,sourceDataset=dataset,sourceName='Imported CSV',population='source',populationCount=sourceDataset?.rows?.length,sampling=null,initialColumns=null,active=true,
  initialType=null,onLink,onShowSheet,onFilterMissing,plan=null}){
  const owner=useRef(datasetOwner()),numeric=useMemo(()=>dataset.headers.filter(h=>dataset.rows.some(r=>typeof r[h]==='number'&&Number.isFinite(r[h]))),[dataset]);
  const available=useMemo(()=>plan?[...new Set([...dataset.headers,...plan.outputFeatures])]:dataset.headers,[dataset,plan]);
  const [config,setConfig]=useState(()=>({type:initialType||(plan?'pipeline_distribution':'histogram'),x:initialColumns?.[0]||numeric[0]||dataset.headers[0],
    y:initialColumns?.[1]||numeric[1]||numeric[0]||dataset.headers[0],columns:initialColumns?.length?initialColumns:numeric.slice(0,4),
    group:'',bins:8,binning:'equal_width',normalization:'count',bandwidth:null,correlation:'pearson',palette:'prism',showLabels:true,
    stage:plan?.artifact.fittedNodes.at(-1)?.id||'',partition:'train',axisMin:null,axisMax:null}));
  const [computed,setComputed]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [records,setRecords]=useState([]),[record,setRecord]=useState(null),[restoredScope,setRestoredScope]=useState(null);
  const [busy,setBusy]=useState(false);
  const scoped=useMemo(()=>{
    if(!restoredScope)return dataset;
    const map=new Map([...sourceDataset.rows,...dataset.rows].map(r=>[r.id,r]));
    return {headers:dataset.headers,rows:restoredScope.ids.map(id=>map.get(id)),provenance:dataset.provenance};
  },[restoredScope,dataset,sourceDataset]);
  const request=useMemo(()=>({config,scoped,sourceDataset,population,plan}),[config,scoped,sourceDataset,population,plan]);
  useEffect(()=>{
    let active=true;
    const build=async()=>{
      const selectionDigest=population==='selection'||population==='working_copy'||restoredScope?await digest(scoped.rows.map(r=>r.id)):null;
      const result=await createChartSpec({dataset:scoped,sourceDataset,sourceName,config,population:restoredScope?.population||population,plan,selectionDigest,populationCount,sampling});
      if(active)setComputed({request,...result});
    };
    build().catch(e=>{if(active)setComputed({request,error:e.message});});
    return()=>{active=false;};
  },[request,config,scoped,sourceDataset,sourceName,population,populationCount,sampling,plan,restoredScope]);
  useEffect(()=>{let active=true;listChartConfigs(owner.current).then(r=>{if(active)setRecords(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  const update=patch=>setConfig(previous=>({...previous,...patch}));
  const run=async fn=>{setError('');setMessage('');try{if(owner.current!==datasetOwner())throw new Error('IDENTITY_CHANGED');await fn();}catch(e){setError(e.message);}};
  const result=computed?.request===request&&!computed.error?computed:null;
  const save=()=>run(async()=>{
    if(!result)return;setBusy(true);
    try{
      const next=await saveChartConfig({id:record?.id||crypto.randomUUID(),name:result.spec.title,config,
        datasetDigest:result.spec.source.datasetDigest,scopeDigest:result.spec.source.scopeDigest,pipelineDigest:result.spec.source.pipelineDigest,
        population:result.spec.source.population,rowIds:(result.scopedDataset||scoped).rows.map(r=>r.id)},record?.revision||0,owner.current);
      setRecord(next);setRecords(await listChartConfigs(owner.current));setMessage('Chart configuration saved locally. Raw observations are not stored; row selection provenance stays in this browser.');
    }finally{setBusy(false);}
  });
  const restore=item=>run(async()=>{
    if(!result)throw new Error('Wait for the current chart evidence.');
    if(item.datasetDigest!==result.spec.source.datasetDigest||item.pipelineDigest!==result.spec.source.pipelineDigest)throw new Error('F18_SAVED_CHART_SOURCE_MISMATCH: Import the matching source dataset / fitted pipeline first.');
    validateChartConfig(item.config,available,{pipeline:!!plan});
    const selection=validatedSelection(sourceDataset,item.rowIds,available.filter(c=>sourceDataset.headers.includes(c)));
    const rowMap=new Map([...sourceDataset.rows,...dataset.rows].map(r=>[r.id,r]));
    const restoredDataset={headers:sourceDataset.headers,rows:selection.ids.map(id=>rowMap.get(id))};
    if(!plan){
      const fingerprint=await digest({headers:restoredDataset.headers,rows:restoredDataset.rows.map(r=>({id:r.id,values:restoredDataset.headers.map(h=>r[h]??null)}))});
      if(fingerprint!==item.scopeDigest)throw new Error('F18_SAVED_CHART_SCOPE_MISMATCH');
      setRestoredScope({...selection,population:item.population});
    }
    setRecord(item);setConfig(item.config);setMessage('Saved configuration restored with matching source and selection provenance.');
  });
  return <section className="prism-f18-studio" aria-label={plan?' fitted pipeline visualization':' Chart Studio'}>
    <header className="prism-chart-head"><div><p className="prism-eyebrow">PRISM / {plan?'FROZEN PIPELINE EVIDENCE':'CHART STUDIO'}</p>
      <h4 className="prism-chart-title">{plan?'Preprocessing, made visible':'Scientific visualization studio'}</h4>
      <p className="prism-subtitle">{plan?'Existing  artifact · training-only fits · no chart-driven refitting':'Explore distributions, relationships and data quality · source remains immutable'}</p></div></header>
    {(restoredScope?.population||population)==='working_copy'&&<p className="prism-feedback" role="note">Working copy chart: draft values are separate from the committed source.  preparation continues to use the committed dataset until you commit edits.</p>}
    <div className="prism-f18-layout">
      <details className="prism-f18-library" open><summary>Chart library & inspector</summary><div className="space-y-3">
        <label>Chart family<select aria-label=" chart type" value={config.type} onChange={e=>{update({type:e.target.value});setRecord(null);}}>
          {CHART_REGISTRY.filter(d=>plan?d.family==='pipeline':d.family!=='pipeline').map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
        </select></label>
        <label>Feature X / inspected column<select aria-label=" X variable" value={config.x} onChange={e=>update({x:e.target.value})}>{available.map(h=><option key={h}>{h}</option>)}</select></label>
        {!plan&&<><label>Feature Y<select aria-label=" Y variable" value={config.y} onChange={e=>update({y:e.target.value})}>{dataset.headers.map(h=><option key={h}>{h}</option>)}</select></label>
          <label>Group / hue<select aria-label=" group variable" value={config.group} onChange={e=>update({group:e.target.value})}><option value="">No grouping</option>{dataset.headers.map(h=><option key={h}>{h}</option>)}</select></label>
          <fieldset><legend>Columns (scatter matrix uses first four; correlations first twelve)</legend><div className="prism-f18-column-list">
            {dataset.headers.map(h=><label key={h}><input type="checkbox" aria-label={' include '+h} checked={config.columns.includes(h)} onChange={e=>update({columns:e.target.checked?[...config.columns,h]:config.columns.filter(c=>c!==h)})}/>{h}</label>)}
          </div></fieldset></>}
        {plan&&<><label>Frozen pipeline node<select aria-label=" pipeline node" value={config.stage} onChange={e=>update({stage:e.target.value})}>{plan.artifact.fittedNodes.map(n=><option key={n.id} value={n.id}>{n.type} · {n.columns.join(', ')}</option>)}</select></label>
          <label>Measured partition<select aria-label=" pipeline partition" value={config.partition} onChange={e=>update({partition:e.target.value})}>{['train','validation','test','all'].map(p=><option key={p}>{p}</option>)}</select></label></>}
        {['histogram','pipeline_distribution'].includes(config.type)&&<><label>Requested bins<input aria-label=" bin count" type="number" min="4" max="16" value={config.bins} onChange={e=>update({bins:Number(e.target.value)})}/></label>
          {!plan&&<><label>Binning strategy<select aria-label=" binning strategy" value={config.binning} onChange={e=>update({binning:e.target.value})}><option value="equal_width">Equal width</option><option value="sturges">Sturges</option><option value="freedman_diaconis">Freedman–Diaconis</option></select></label>
            <label>Histogram normalization<select aria-label=" normalization" value={config.normalization} onChange={e=>update({normalization:e.target.value})}>{['count','frequency','density'].map(s=><option key={s}>{s}</option>)}</select></label></>}
        </>}
        {['kde','violin'].includes(config.type)&&<label>Gaussian bandwidth (blank = documented automatic rule)<input aria-label=" bandwidth" type="number" step="any" min="0" value={config.bandwidth??''} onChange={e=>update({bandwidth:e.target.value===''?null:Number(e.target.value)})}/></label>}
        {['correlation','correlation_rank'].includes(config.type)&&<label>Correlation method<select aria-label=" correlation method" value={config.correlation} onChange={e=>update({correlation:e.target.value})}><option value="pearson">Pearson</option><option value="spearman">Spearman (average tied ranks)</option></select></label>}
        <label>Palette<select aria-label=" palette" value={config.palette} onChange={e=>update({palette:e.target.value})}>{['prism','publication','diverging'].map(p=><option key={p}>{p}</option>)}</select></label>
        <label><input type="checkbox" checked={config.showLabels} onChange={e=>update({showLabels:e.target.checked})}/> Show heatmap labels when space permits</label>
        <div className="prism-f18-axis-controls">{[['axisMin','Y minimum'],['axisMax','Y maximum']].map(([key,label])=><label key={key}>{label}<input aria-label={' '+label} type="number" step="any" value={config[key]??''} onChange={e=>update({[key]:e.target.value===''?null:Number(e.target.value)})}/></label>)}</div>
        <button disabled={!result||busy} className="prism-action" onClick={save}>Save chart configuration</button>
        {restoredScope&&<button className="prism-action" onClick={()=>{setRestoredScope(null);setRecord(null);}}>Return to current analysis population</button>}
        <details><summary>Saved charts ({records.length})</summary>{records.map(item=><div className="prism-f18-saved" key={item.id}>
          <button onClick={()=>restore(item)}>{item.name} · revision {item.revision}</button><button aria-label={'Delete saved chart '+item.name} onClick={()=>run(async()=>{await deleteChartConfig(item.id,owner.current);setRecords(await listChartConfigs(owner.current));if(record?.id===item.id)setRecord(null);})}>Delete</button>
        </div>)}</details>
      </div></details>
      <div className="min-w-0">
        {result&&active?<ScientificChart key={result.spec.chartId} result={result} dataset={result.scopedDataset||scoped} onLink={onLink} onShowSheet={onShowSheet} onFilterMissing={onFilterMissing}/>:
          computed?.request===request&&computed.error?<p role="alert" className="prism-empty">{computed.error}</p>:<p role="status" className="prism-empty">Measuring chart evidence…</p>}
      </div>
    </div>
    {error&&<p role="alert" className="prism-feedback">{error}</p>}{message&&<p role="status" className="prism-feedback">{message}</p>}
  </section>;
}
