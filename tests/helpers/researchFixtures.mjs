import {fixture} from './modelChartFixtures.mjs';
import {createRunReceipt} from '../../client/src/ml/modelRegistry/runContracts.js';
import {mean,sampleSd} from '../../client/src/ml/modelSelection/searchAnalytics.js';
export function searchFixture(count=3,folds=3){
  return {kind:'neuroforge-f15-search',schemaVersion:1,scope:'original-training-inner-cv',algorithm:'cart',task:'binary_classification',metric:'accuracy',direction:'maximize',folds,seed:42,foldMembershipDigest:'a'.repeat(64),sourceTrainingCount:60,status:'complete',selectedIndex:count-1,results:Array.from({length:count},(_,i)=>{const scores=Array.from({length:folds},(_,j)=>.5+i*.02+j*.01);return {configIndex:i,configuration:{maxDepth:i%5+1,minLeaf:2+Math.floor(i/5)},status:'complete',foldScores:scores,foldCounts:Array(folds).fill(60/folds),mean:mean(scores),sampleSd:sampleSd(scores),reason:null};})};
}
export async function runFixtures(count=3,{task='classification',algorithm='cart'}={}){
  const ctx=fixture(task,algorithm),base=await createRunReceipt({...ctx,title:'Run 1'});
  const runs=Array.from({length:count},(_,i)=>({...structuredClone(base),id:'f14-run:research-run-'+i,runId:'research-run-'+i,title:'Run '+(i+1),createdAt:new Date(Date.UTC(2026,0,i+1)).toISOString()}));
  return runs;
}
export async function archivedFixture(count=3,folds=3){
  const [run]=await runFixtures(1),search=searchFixture(count,folds);search.sourceTrainingCount=run.counts.train;search.results.forEach(t=>{t.foldCounts=Array(folds).fill(Math.floor(run.counts.train/folds));t.foldCounts[0]+=run.counts.train%folds;});
  const chosen=search.results.at(-1);run.model.config={...chosen.configuration};
  run.selectionEvidence={...search,kind:'neuroforge-f15-selection',selectedMean:chosen.mean,selectedSampleSd:chosen.sampleSd,trials:search.results};delete run.selectionEvidence.results;
  return run;
}
