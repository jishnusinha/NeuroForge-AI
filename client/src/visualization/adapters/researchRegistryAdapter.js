import {evidence,col} from '../chartEvidence.js';
import {REGISTRY_METRICS} from '../../ml/modelRegistry/comparability.js';
export function compute({runs,comparison,request,comparisons}){
  const {chartType,metric,secondaryMetric='macroF1'}=request,rows=[],links=[],notes=[...comparison.notes,...comparison.reasons,
    'Only recorded fixed validation measurements are compared. Final-test metrics are never used. Contextual collections have no ranked winner or comparable delta.'];
  const label=r=>'Run '+(runs.indexOf(r)+1)+': '+r.title;
  const add=(row,run)=>{rows.push(row);links.push(run?[run.runId]:[]);};
  let columns=[col('x','text'),col('y'),col('series','text'),col('run_ref','text'),col('rank')],plot={kind:'bar',xLabel:'Saved experiment',yLabel:'Fixed validation '+metric};
  const ranked=comparison.rankings.map(p=>runs.find(r=>r.runId===p.runId));
  if(chartType==='research_leaderboard'){
    for(const r of comparison.status==='comparable'?ranked:runs)add({x:label(r),y:r.validation.metrics[metric]??null,series:comparison.status==='comparable'?'Comparable validation':'Context only — not ranked',run_ref:r.runId,rank:comparison.rankings.find(p=>p.runId===r.runId)?.rank??null},r);
    notes.push('Equal scores share a competition rank. Fold variability is not used as an unvalidated tie breaker.');
  }else if(chartType==='research_matrix'){
    columns=[col('x','text'),col('y','text'),col('value'),col('score'),col('direction','text'),col('status','text'),col('run_ref','text')];
    const metrics=Object.keys(REGISTRY_METRICS).filter(k=>runs.some(r=>REGISTRY_METRICS[k].tasks.includes(r.task.type)));
    for(const m of metrics){const state=comparisons[m];
      for(const r of runs){const position=state.rankings.find(p=>p.runId===r.runId),score=r.validation.metrics[m]??null;
        add({x:m,y:label(r),value:score===null?null:state.status==='comparable'?(position.rank-1)/Math.max(1,runs.length-1):.5,score,direction:REGISTRY_METRICS[m].direction,status:state.status,run_ref:r.runId},r);}}
    plot={kind:'heatmap',xLabel:'Metric (separate definitions)',yLabel:'Saved run',scaleMin:0,scaleMax:1,scaleName:'Within-metric rank position: 0 best; context cells neutral'};
    notes.push('Color is a within-column rank position, not a shared metric scale. Contextual cells are neutral 0.5; raw recorded scores and status are in Data. Missing scores have no cell.');
  }else if(chartType==='research_tradeoff'){
    if(!REGISTRY_METRICS[secondaryMetric]||secondaryMetric===metric)throw new Error('F20_SECOND_METRIC_REQUIRED');
    columns=[col('x'),col('y'),col('series','text'),col('run_ref','text')];
    for(const r of runs)add({x:r.validation.metrics[metric]??null,y:r.validation.metrics[secondaryMetric]??null,series:label(r),run_ref:r.runId},r);
    plot={kind:'scatter',xLabel:'Fixed validation '+metric,yLabel:'Fixed validation '+secondaryMetric};notes.push('Each point is one recorded experiment. No combined score, Pareto superiority claim, or inferred missing measurement.');
  }else if(chartType==='research_difference'){
    if(runs.length!==2)throw new Error('F20_TWO_RUNS_REQUIRED');
    columns=[col('x','text'),col('y'),col('baseline','text'),col('comparison','text'),col('left_score'),col('right_score')];
    add({x:metric,y:comparison.status==='comparable'?runs[1].validation.metrics[metric]-runs[0].validation.metrics[metric]:null,baseline:runs[0].runId,comparison:runs[1].runId,left_score:runs[0].validation.metrics[metric]??null,right_score:runs[1].validation.metrics[metric]??null},runs[1]);
    plot={kind:'bar',reference:'zero',xLabel:'Second selected run minus first selected run',yLabel:'Signed '+metric+' difference'};
    notes.push('A signed difference is provided only for comparable runs; its interpretation follows the metric direction.');
  }else if(chartType==='research_timeline'){
    columns=[col('x'),col('y'),col('series','text'),col('recorded_at','text'),col('run_ref','text')];
    for(const r of [...runs].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)))add({x:Date.parse(r.createdAt),y:r.validation.metrics[metric]??null,series:label(r),recorded_at:r.createdAt,run_ref:r.runId},r);
    plot={kind:'scatter',timeAxis:true,xLabel:'Recorded creation time (UTC)',yLabel:'Fixed validation '+metric};notes.push('Chronology is not a learning curve. Points are not connected and timestamps are not training iterations.');
  }else if(chartType==='research_provenance'){
    columns=[col('x','text'),col('y','text'),col('value'),col('fingerprint','text'),col('run_ref','text')];
    for(const key of ['sourceDigest','splitDigest','pipelineDigest','featureSchemaDigest'])for(const r of runs)add({x:key,y:label(r),value:r.lineage[key]===runs[0].lineage[key]?1:0,fingerprint:r.lineage[key],run_ref:r.runId},r);
    plot={kind:'heatmap',xLabel:'Identity dimension',yLabel:'Saved run',scaleMin:0,scaleMax:1,scaleName:'Matches first selected run: 1 yes / 0 no'};
    notes.push('Identity matching is categorical, not a quality score. Different pipelines/features do not by themselves invalidate an otherwise identical evaluation population.');
  }else throw new Error('F20_UNKNOWN_REGISTRY_CHART');
  const result=evidence({columns,rows,plot,kind:plot.kind,links,notes,stats:{comparisonStatus:comparison.status,metric,direction:comparison.direction,runs:runs.length,rankingPermitted:comparison.status==='comparable',leaders:comparison.leaders},warnings:comparison.status==='comparable'?[]:[comparison.status.toUpperCase()+': '+comparison.reasons.join(' ')]});
  if(!rows.some(r=>r.value!=null||typeof r.y==='number'))result.evidence.status='unavailable';
  return result;
}
