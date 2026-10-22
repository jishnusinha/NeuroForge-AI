import {useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {PrismStatus} from '../../../design/components/Prism.jsx';
import {REGISTRY_METRICS,compareRunCollection} from '../../../ml/modelRegistry/comparability.js';
import {filterResearchRuns} from '../../../ml/modelRegistry/researchAnalytics.js';
import {RESEARCH_CHARTS} from '../../../visualization/chartRegistry.js';
import {downloadText} from '../../../visualization/chartExport.js';
import {createResearchComparisonReport,createResearchComparisonSnapshot} from '../../../ml/modelRegistry/reports.js';
import ResearchChart from '../charts/ResearchChart.jsx';
import SearchVisualization from '../charts/SearchVisualization.jsx';
export default function ResearchDashboard({runs,onOpen}){
  const [params]=useSearchParams(),detailsRef=useRef(null),showResearch=params.get('view')==='research';
  const [preview,setPreview]=useState(false);
  useEffect(()=>{if(showResearch&&detailsRef.current)detailsRef.current.open=true;},[showResearch]);
  const [order,setOrder]=useState('created');
  const [open,setOpen]=useState(false),[ids,setIds]=useState([]),[filters,setFilters]=useState({query:'',task:'all',algorithm:'all',tag:'all',source:'all',population:'all'}),[metric,setMetric]=useState('accuracy'),[secondary,setSecondary]=useState('macroF1'),[chartType,setChartType]=useState('research_leaderboard'),[palette,setPalette]=useState('prism'),[notes,setNotes]=useState(''),[limitations,setLimitations]=useState(''),[message,setMessage]=useState(''),[inspect,setInspect]=useState('');
  const selected=ids.filter(id=>runs.some(r=>r.runId===id)),chosen=runs.filter(r=>selected.includes(r.runId));
  const source=useMemo(()=>({kind:'f14-archive',receipts:runs}),[runs]);
  const visible=filterResearchRuns(runs,filters),archived=runs.find(r=>r.runId===inspect);
  let comparison;try{if(chosen.length>=2)comparison=compareRunCollection(chosen,metric);}catch(error){comparison={status:'unavailable',reasons:[error.message],notes:[]};}
  const canSort=comparison?.status==='comparable'&&visible.every(r=>selected.includes(r.runId));
  const ordered=[...visible].sort((a,b)=>order==='title'?a.title.localeCompare(b.title):order==='metric'&&canSort?(REGISTRY_METRICS[metric].direction==='minimize'?1:-1)*(a.validation.metrics[metric]-b.validation.metrics[metric]):Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const update=(key,value)=>setFilters(old=>({...old,[key]:value}));
  const previewText=useMemo(()=>{if(!preview)return '';try{return createResearchComparisonReport(runs.filter(r=>ids.includes(r.runId)),{metric,observations:notes,limitations});}catch(error){return 'Report unavailable: '+error.message;}},[preview,runs,ids,metric,notes,limitations]);
  const download=async json=>{try{const options={metric,observations:notes,limitations};downloadText('neuroforge-research-report.'+(json?'json':'md'),json?JSON.stringify(await createResearchComparisonSnapshot(chosen,options),null,2):createResearchComparisonReport(chosen,options),json?'application/json':'text/markdown');setMessage('Research report exported.');}catch(error){setMessage(error.message);}};
  return <details ref={detailsRef} className="prism-chart-card" onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer p-4 font-semibold">F20 — Research Intelligence · Compare Research Runs</summary>{open&&<section aria-label="F20 Research Intelligence" className="prism-research-workspace space-y-4 p-3">
    <p>Select 2–10 saved runs. Rankings require matching source, split, task, target and metric definition. Final-test results never tune this comparison.</p>
    <div className="prism-sheet-tools"><label>Search<input aria-label="F20 search runs" value={filters.query} onChange={e=>update('query',e.target.value)}/></label>
    {['task','algorithm','tag','source','population'].map(key=>{const values=[...new Set(runs.flatMap(r=>key==='task'?[r.task.type]:key==='algorithm'?[r.model.algorithm]:key==='tag'?r.tags:[r.lineage[key==='source'?'sourceDigest':'splitDigest']]))];return <label key={key}>{key}<select aria-label={'F20 filter '+key} value={filters[key]} onChange={e=>update(key,e.target.value)}><option value="all">All</option>{values.map(v=><option key={v} value={v}>{v}</option>)}</select></label>;})}
    <label>Metric<select aria-label="F20 metric" value={metric} onChange={e=>setMetric(e.target.value)}>{Object.keys(REGISTRY_METRICS).map(m=><option key={m}>{m}</option>)}</select></label></div>
    <button onClick={()=>setIds(visible.slice(0,10).map(r=>r.runId))}>Select visible runs (up to 10)</button> <button onClick={()=>setIds([])}>Clear research selection</button>
    <label>Table order<select aria-label="F20 table order" value={order==='metric'&&!canSort?'created':order} onChange={e=>setOrder(e.target.value)}><option value="created">Chronology</option><option value="title">Title</option><option value="metric" disabled={!canSort}>Comparable metric</option></select></label>
    <div className="prism-table-scroll" role="region" tabIndex={0} aria-label="Research run evidence"><table className="prism-data-table"><caption>{visible.length} visible runs · {selected.length} selected</caption><thead><tr><th scope="col">Select</th><th scope="col">Run</th><th scope="col">Algorithm</th><th scope="col">{metric}</th><th scope="col">Recorded at</th><th scope="col">Inspect</th></tr></thead><tbody>{ordered.map(r=><tr key={r.runId}><td><input type="checkbox" aria-label={'F20 compare '+r.title} checked={selected.includes(r.runId)} disabled={!selected.includes(r.runId)&&selected.length>=10} onChange={()=>setIds(selected.includes(r.runId)?selected.filter(id=>id!==r.runId):[...selected,r.runId])}/></td><td>{r.title}</td><td>{r.model.algorithm}</td><td>{r.validation.metrics[metric]??'Unavailable'}</td><td>{r.createdAt}</td><td><button onClick={()=>{setInspect(r.runId);onOpen(r);}}>Open run</button></td></tr>)}</tbody></table></div>
    {comparison&&<><PrismStatus announce tone={comparison.status==='comparable'?'success':'warning'}>Comparison: {comparison.status}</PrismStatus>{[...comparison.reasons,...comparison.notes].map((note,i)=><p key={i}>{note}</p>)}
      <div className="prism-sheet-tools"><label>Research visualization<select aria-label="F20 research visualization" value={chartType} onChange={e=>setChartType(e.target.value)}>{RESEARCH_CHARTS.filter(d=>d.family==='research_registry').map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label><label>Second metric<select value={secondary} onChange={e=>setSecondary(e.target.value)}>{Object.keys(REGISTRY_METRICS).map(m=><option key={m}>{m}</option>)}</select></label><label>Palette<select value={palette} onChange={e=>setPalette(e.target.value)}>{['prism','publication','diverging'].map(p=><option key={p}>{p}</option>)}</select></label></div>
      <ResearchChart source={source} request={{chartType,metric,secondaryMetric:secondary,selectedRunIds:selected,palette}} onLink={linked=>{const run=runs.find(r=>r.runId===linked[0]);if(run){setInspect(run.runId);onOpen(run);}}}/>
      <label>Research notes<textarea maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)}/></label><label>Validity limitations<textarea maxLength={4000} value={limitations} onChange={e=>setLimitations(e.target.value)}/></label>
      <details onToggle={e=>setPreview(e.currentTarget.open)}><summary>Preview research report</summary>{preview&&<pre tabIndex={0} className="prism-code-block" aria-label="Research report preview">{previewText}</pre>}</details>
      <button onClick={()=>download(false)}>Download research Markdown</button> <button onClick={()=>download(true)}>Download research JSON</button>
    </>}
    {archived&&<SearchVisualization receipt={archived}/>} {message&&<p role="status">{message}</p>}
  </section>}</details>;
}
