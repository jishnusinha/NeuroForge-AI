import {evidence,col} from '../chartEvidence.js';
import {rankSearchTrials,pairedTrialDifferences} from '../../ml/modelSelection/searchAnalytics.js';
export function compute({search,request,receipt=null}){
  const {chartType}=request,rows=[],links=[],metric=search.metric,ranked=rankSearchTrials(search),notes=[
    'Recorded original-training inner-CV evidence only. No model is fitted, predicted, or promoted by chart computation.',
    'Mean and sample SD describe fold variation, not confidence intervals or statistical superiority. Partial/unavailable trials cannot win.'];
  const add=(row,t)=>{rows.push(row);links.push(t?['trial:'+t.configIndex]:[]);};
  const config=t=>JSON.stringify(t.configuration),name=t=>'Trial '+(t.configIndex+1);
  let columns=[col('x','text'),col('y'),col('series','text'),col('configuration','text'),col('status','text')],plot={kind:'bar',xLabel:'Tested configuration',yLabel:'Inner CV '+metric};
  if(chartType==='cv_folds'){
    columns=[...columns,col('point_kind','text'),col('fold'),col('support'),col('mean'),col('sd'),col('low'),col('high')];
    for(const t of search.trials){t.foldScores.forEach((score,i)=>add({x:name(t),y:score,series:'Recorded fold scores',configuration:config(t),status:t.status,point_kind:'fold',fold:i+1,support:t.foldCounts[i]??null,mean:t.mean,sd:t.sampleSd,low:null,high:null},t));
      if(t.status==='complete')add({x:name(t),y:t.mean,series:'Mean ± sample SD',configuration:config(t),status:t.status,point_kind:'mean',fold:null,support:null,mean:t.mean,sd:t.sampleSd,low:t.mean-t.sampleSd,high:t.mean+t.sampleSd},t);}
    plot={kind:'fold_scores',xLabel:'Tested trial (exact configuration in Data)',yLabel:'Inner CV '+metric};
    notes.push('Every recorded fold is a dot. Diamonds and vertical bars are complete-trial means ± sample SD. Tied fold values can overlap; Data retains every record.');
  }else if(chartType==='cv_heatmap'){
    columns=[col('x','text'),col('y','text'),col('value'),col('support'),col('status','text'),col('configuration','text')];
    for(const t of search.trials)for(let i=0;i<search.folds;i++)add({x:'Fold '+(i+1),y:name(t),value:t.foldScores[i]??null,support:t.foldCounts[i]??null,status:t.status,configuration:config(t)},t);
    const scores=search.trials.flatMap(t=>t.foldScores),lo=scores.length?Math.min(...scores):0,hi=scores.length?Math.max(...scores):1;
    plot={kind:'heatmap',xLabel:'Matching inner fold index',yLabel:'Tested trial',scaleMin:lo===hi?lo-.5:lo,scaleMax:lo===hi?hi+.5:hi,diverging:lo<0&&hi>0,scaleName:'Recorded inner-fold '+metric};
    notes.push('Missing and failed fold scores remain blank, never zero. Color uses the recorded score range, including negative R².');
  }else if(chartType==='cv_response'){
    const parameter=request.parameter;if(!parameter||!search.trials.some(t=>typeof t.configuration[parameter]==='number'))throw new Error('F20_RECORDED_PARAMETER_REQUIRED');
    columns=[col('x'),col('y'),col('series','text'),col('configuration','text'),col('status','text'),col('sd')];
    for(const t of search.trials)add({x:t.configuration[parameter]??null,y:t.mean,series:name(t),configuration:config(t),status:t.status,sd:t.sampleSd},t);
    plot={kind:'scatter',xLabel:'Actually tested '+parameter,yLabel:'Inner CV mean '+metric};notes.push('Only tested settings are shown. Other parameters may differ (see configuration). No interpolated curve, smooth surface, or isolated causal parameter effect is inferred.');
  }else if(chartType==='cv_leaderboard'){
    columns=[...columns,col('rank'),col('sd'),col('reason','text')];
    for(const t of [...ranked,...search.trials.filter(t=>t.status!=='complete')])add({x:name(t),y:t.mean,series:'Complete-trial mean',configuration:config(t),status:t.status,rank:ranked.find(r=>r.configIndex===t.configIndex)?.rank??null,sd:t.sampleSd,reason:t.reason},t);
    notes.push('Equal means share a competition rank. SD is reported rather than used as an unsupported significance claim.');
  }else if(chartType==='cv_support'){
    columns=[...columns,col('fold')];
    for(const t of search.trials)for(let i=0;i<search.folds;i++)add({x:'Fold '+(i+1),y:t.foldCounts[i]??null,series:name(t),configuration:config(t),status:t.status,fold:i+1},t);
    plot={kind:'bar',xLabel:'Inner validation fold',yLabel:'Recorded observation count'};notes.push('Counts are read from foldCounts. Historical receipts without counts cannot reconstruct support; no equal-sized folds are assumed.');
  }else if(chartType==='cv_outer'){
    columns=[col('x','text'),col('y'),col('stage','text'),col('configuration','text')];
    const t=search.trials.find(t=>t.configIndex===search.selectedIndex);
    if(receipt&&t){add({x:'Inner CV mean',y:t.mean,stage:'original-training-inner-cv',configuration:config(t)},t);add({x:'Fixed outer validation',y:receipt.validation.metrics[metric]??null,stage:'fixed-validation',configuration:config(t)},t);}
    plot={kind:'bar',xLabel:'Distinct measurement stages — not a shared leaderboard',yLabel:metric};
    notes.push('Requires a saved promoted model run. Inner-CV and outer-validation scores remain separate; their difference is not a validated generalization-gap estimate. Final-test scores are excluded.');
  }else if(chartType==='cv_paired'){
    const selected=request.selectedTrialIndexes||ranked.slice(0,2).map(t=>t.configIndex),paired=pairedTrialDifferences(search,selected);
    columns=[col('x','text'),col('y'),col('first_trial'),col('second_trial'),col('fold')];
    const t=search.trials.find(t=>t.configIndex===selected[1]);
    paired.differences.forEach((y,i)=>add({x:'Fold '+(i+1),y,first_trial:selected[0]+1,second_trial:selected[1]+1,fold:i+1},t));
    add({x:'Mean difference',y:paired.mean,first_trial:selected[0]+1,second_trial:selected[1]+1,fold:null},t);
    plot={kind:'bar',reference:'zero',xLabel:'Second selected trial minus first selected trial',yLabel:'Paired '+metric+' difference'};
    notes.push('Paired only within this exact search/fold digest and metric definition. Overlapping fold training sets are not independent confidence samples. No p-value or confidence interval is claimed.');
  }else throw new Error('F20_UNKNOWN_SELECTION_CHART');
  const warnings=[];if(search.trials.some(t=>t.status!=='complete'))warnings.push('Incomplete or unavailable trials are retained in Data and excluded from ranking and mean/SD summaries.');
  const result=evidence({columns,rows,plot,kind:plot.kind,links,notes,warnings,stats:{metric,direction:search.direction,folds:search.folds,trainingObservations:search.sourceTrainingCount,completedTrials:ranked.length,
    trials:search.trials.map(t=>({trial:t.configIndex+1,status:t.status,mean:t.mean,sampleSd:t.sampleSd,recordedFolds:t.foldScores.length})),foldMembershipDigest:search.foldMembershipDigest}});
  if(!rows.some(r=>r.value!=null||typeof r.y==='number')){result.evidence.status='unavailable';result.evidence.warnings.push('Required measurements were not recorded for this view.');}
  return result;
}
