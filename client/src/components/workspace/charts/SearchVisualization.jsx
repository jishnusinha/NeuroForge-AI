import {useMemo,useState} from 'react';
import {RESEARCH_CHARTS} from '../../../visualization/chartRegistry.js';
import ResearchChart from './ResearchChart.jsx';
export default function SearchVisualization({search,receipt,onSelect,disabled=false}){
  const [open,setOpen]=useState(false),[chartType,setChartType]=useState('cv_folds'),[parameter,setParameter]=useState('maxDepth'),[pair,setPair]=useState([0,1]);
  const [inspected,setInspected]=useState(null);
  const source=useMemo(()=>receipt?{kind:'f15-archived',receipt}:{kind:'f15-live',search},[receipt,search]);
  if(!search&&!receipt?.selectionEvidence)return null;
  const trials=receipt?.selectionEvidence?.trials||search?.results||[];
  const inspectedTrial=inspected?.source===source?trials.find(t=>t.configIndex===inspected.index):null;
  return <details onToggle={e=>setOpen(e.currentTarget.open)} className="prism-chart-card"><summary className="cursor-pointer p-4 font-semibold">F20 — Search analytics</summary>{open&&<section aria-label="F20 search analytics" className="prism-research-workspace space-y-3 p-3">
    <p>Recorded inner-CV evidence only. Fold SD describes variability, not a confidence interval. Selecting a trial does not train it.</p>
    <label>Search visualization<select aria-label="F20 search visualization" value={chartType} onChange={e=>setChartType(e.target.value)}>{RESEARCH_CHARTS.filter(d=>d.family==='research_selection'&&(receipt||d.id!=='cv_outer')).map(d=><option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
    {chartType==='cv_response'&&<label>Tested parameter<select value={parameter} onChange={e=>setParameter(e.target.value)}>{['lambda','epochs','k','maxDepth','minLeaf','trees','seed'].map(p=><option key={p}>{p}</option>)}</select></label>}
    {chartType==='cv_paired'&&pair.map((value,i)=><label key={i}>Paired trial {i+1}<select aria-label={'F20 paired trial '+(i+1)} value={value} onChange={e=>setPair(old=>old.map((v,j)=>j===i?Number(e.target.value):v))}>{trials.map(t=><option key={t.configIndex} value={t.configIndex}>Trial {t.configIndex+1} ({t.status})</option>)}</select></label>)}
    <ResearchChart source={source} request={{chartType,...(chartType==='cv_response'?{parameter}:{}),...(chartType==='cv_paired'?{selectedTrialIndexes:pair}:{})}} onLink={ids=>{if(ids.length===1){const index=Number(ids[0].split(':')[1]),trial=trials.find(t=>t.configIndex===index);if(trial){setInspected({source,index});if(!disabled&&onSelect&&trial.status==='complete')onSelect(index);}}}}/>
    {inspectedTrial&&<section aria-label="F20 inspected trial"><h5>Inspected trial {inspectedTrial.configIndex+1} · {inspectedTrial.status}</h5><p>Recorded configuration: {JSON.stringify(inspectedTrial.configuration)}</p><p>Recorded fold scores: {inspectedTrial.foldScores.join(', ')||'Unavailable'}</p></section>}
    {disabled&&<p>Trial promotion is disabled while the search is running.</p>}
    {receipt&&<p>Archived summary only: this does not restore training data or a fitted pipeline.</p>}
  </section>}</details>;
}
