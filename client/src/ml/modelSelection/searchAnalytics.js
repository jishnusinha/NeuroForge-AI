import {validateSearchRequest} from './searchManifest.js';
import {validateSelectionEvidence} from './selectionEvidence.js';
export const finite=x=>typeof x==='number'&&Number.isFinite(x);
export const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
export const sampleSd=xs=>xs.length>1?Math.sqrt(xs.reduce((s,x)=>s+(x-mean(xs))**2,0)/(xs.length-1)):null;
const close=(a,b)=>a===b||finite(a)&&finite(b)&&Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b));
const parameterKeys=['lambda','epochs','k','maxDepth','minLeaf','trees','seed'];
export function researchConfiguration(config){
  if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).length>8||Object.entries(config).some(([k,v])=>!parameterKeys.includes(k)||!finite(v)))throw new Error('F20_INVALID_CONFIGURATION_EVIDENCE');
  return {...config};
}
/** Validate recorded evidence without fitting, predicting, or inspecting rows. */
export function normalizeSearchEvidence(input,{archived=false}={}){
  if(!input||input.schemaVersion!==1||input.kind!==(archived?'neuroforge-f15-selection':'neuroforge-f15-search')||input.scope!=='original-training-inner-cv'||
     !['regression','binary_classification','multiclass_classification'].includes(input.task)||!Number.isInteger(input.sourceTrainingCount)||input.sourceTrainingCount<6||input.sourceTrainingCount>2000||!/^[a-f0-9]{64}$/.test(input.foldMembershipDigest||''))throw new Error('F20_INVALID_SEARCH_EVIDENCE');
  if(archived)validateSelectionEvidence(input,input.algorithm,input.task);
  const trials=archived?input.trials:input.results;
  if(!Array.isArray(trials)||!trials.length||trials.length>12||new Set(trials.map(t=>t.configIndex)).size!==trials.length)throw new Error('F20_INVALID_TRIALS');
  const request=validateSearchRequest(input.task,input.algorithm,{folds:input.folds,seed:input.seed,metric:input.metric,configs:trials.map(t=>researchConfiguration(t.configuration))});
  if(request.direction!==input.direction||!archived&&!['running','complete','unavailable'].includes(input.status))throw new Error('F20_INVALID_SEARCH_DIRECTION');
  let knownCounts=null;
  const normalized=trials.map(t=>{
    if(!Number.isInteger(t.configIndex)||t.configIndex<0||t.configIndex>11||!['complete','unavailable',...(archived?[]:['incomplete'])].includes(t.status)||
       !Array.isArray(t.foldScores)||t.foldScores.length>input.folds||t.foldScores.some(x=>!finite(x))||t.foldMembershipDigest&&t.foldMembershipDigest!==input.foldMembershipDigest)throw new Error('F20_INVALID_FOLD_EVIDENCE');
    const counts=t.foldCounts??[];
    if(!Array.isArray(counts)||counts.length&&counts.length!==t.foldScores.length||counts.some(n=>!Number.isInteger(n)||n<1||n>input.sourceTrainingCount))throw new Error('F20_INVALID_FOLD_COUNTS');
    if(counts.length===input.folds&&counts.reduce((s,n)=>s+n,0)!==input.sourceTrainingCount)throw new Error('F20_INVALID_FOLD_COUNTS');
    if(knownCounts&&counts.some((n,i)=>knownCounts[i]!==undefined&&knownCounts[i]!==n))throw new Error('F20_FOLD_MEMBERSHIP_MISMATCH');
    if(!knownCounts||counts.length>knownCounts.length)knownCounts=counts;
    if(t.status==='complete'){
      if(t.foldScores.length!==input.folds||!close(t.mean,mean(t.foldScores))||!close(t.sampleSd,sampleSd(t.foldScores)))throw new Error('F20_INVALID_FOLD_SUMMARY');
    }else if(t.mean!=null||t.sampleSd!=null)throw new Error('F20_PARTIAL_TRIAL_SUMMARY');
    if(input.metric!=='r2'&&t.foldScores.some(x=>x<0)||['accuracy','macroF1'].includes(input.metric)&&t.foldScores.some(x=>x>1))throw new Error('F20_INVALID_FOLD_SCORE');
    return {configIndex:t.configIndex,configuration:researchConfiguration(t.configuration),status:t.status,foldScores:[...t.foldScores],foldCounts:[...counts],
      mean:t.status==='complete'?t.mean:null,sampleSd:t.status==='complete'?t.sampleSd:null,
      reason:t.status==='complete'?null:(typeof t.reason==='string'?t.reason.match(/^F\d+_[A-Z0-9_]+/)?.[0]:null)||'Required fold measurements are incomplete or unavailable.'};
  });
  if(archived){const selected=normalized.find(t=>t.configIndex===input.selectedIndex);if(!selected||selected.status!=='complete'||!close(input.selectedMean,selected.mean)||!close(input.selectedSampleSd,selected.sampleSd))throw new Error('F20_INVALID_SELECTED_TRIAL');}
  return {kind:archived?'f15-archived-summary':'f15-live-summary',scope:input.scope,algorithm:input.algorithm,task:input.task,metric:input.metric,direction:input.direction,
    folds:input.folds,seed:input.seed,foldMembershipDigest:input.foldMembershipDigest,sourceTrainingCount:input.sourceTrainingCount,
    status:archived?'complete':input.status,selectedIndex:input.selectedIndex??null,trials:normalized};
}
export function rankSearchTrials(search){
  const ranked=search.trials.filter(t=>t.status==='complete').sort((a,b)=>(search.direction==='minimize'?a.mean-b.mean:b.mean-a.mean)||a.configIndex-b.configIndex);
  return ranked.map(t=>({...t,rank:ranked.findIndex(r=>r.mean===t.mean)+1}));
}
export function pairedTrialDifferences(search,indexes){
  if(!Array.isArray(indexes)||indexes.length!==2||indexes[0]===indexes[1])throw new Error('F20_TWO_MATCHED_TRIALS_REQUIRED');
  const pair=indexes.map(i=>search.trials.find(t=>t.configIndex===i));
  if(pair.some(t=>!t||t.status!=='complete'||t.foldScores.length!==search.folds)||pair[0].foldCounts.length&&pair[1].foldCounts.length&&JSON.stringify(pair[0].foldCounts)!==JSON.stringify(pair[1].foldCounts))throw new Error('F20_TWO_MATCHED_TRIALS_REQUIRED');
  const differences=pair[1].foldScores.map((score,i)=>score-pair[0].foldScores[i]);
  return {differences,mean:mean(differences),sampleSd:sampleSd(differences)};
}
