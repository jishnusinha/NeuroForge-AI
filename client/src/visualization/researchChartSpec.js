import {digest} from '../../../shared/domain.mjs';
import {chartDefinition,loadChartAdapter,CHART_REGISTRY_VERSION} from './chartRegistry.js';
import {validateChartSpec} from './chartSpecV2.js';
import {projectResearchRun,analyzeResearchRuns} from '../ml/modelRegistry/researchAnalytics.js';
import {normalizeSearchEvidence} from '../ml/modelSelection/searchAnalytics.js';
import {REGISTRY_METRICS,compareRunCollection} from '../ml/modelRegistry/comparability.js';
/** Research summaries have their own contract; no fabricated observation dataset. */
export async function createResearchChartSpec(input){
  if(!input||Object.keys(input).some(k=>!['source','chartType','metric','secondaryMetric','selectedRunIds','selectedTrialIndexes','palette','parameter'].includes(k))||!['prism','publication','diverging'].includes(input.palette||'prism'))throw new Error('F20_INVALID_CHART_REQUEST');
  if(input.selectedTrialIndexes!==undefined&&!Array.isArray(input.selectedTrialIndexes)||input.parameter!==undefined&&!['lambda','epochs','k','maxDepth','minLeaf','trees','seed'].includes(input.parameter)||input.secondaryMetric!==undefined&&!REGISTRY_METRICS[input.secondaryMetric])throw new Error('F20_INVALID_CHART_REQUEST');
  const def=chartDefinition(input.chartType),source=input.source;
  if(!source||!['f14-archive','f15-live','f15-archived'].includes(source.kind)||!def.family.startsWith('research_'))throw new Error('F20_RESEARCH_CONTEXT_REQUIRED');
  const request={chartType:input.chartType,metric:input.metric,secondaryMetric:input.secondaryMetric,selectedTrialIndexes:input.selectedTrialIndexes?[...input.selectedTrialIndexes]:undefined,parameter:input.parameter,palette:input.palette||'prism'};
  let context,args,snapshot,rowCount,sourceCount,comparison;
  if(source.kind==='f14-archive'){
    if(def.family!=='research_registry'||!Array.isArray(source.receipts)||source.receipts.length>30||source.receipts.length<2||!REGISTRY_METRICS[request.metric])throw new Error('F20_ARCHIVE_SOURCE_REQUIRED');
    const all=source.receipts.map(projectResearchRun),ids=input.selectedRunIds??all.map(r=>r.runId);
    if(!Array.isArray(ids)||ids.length<2||ids.length>10||new Set(ids).size!==ids.length||new Set(all.map(r=>r.runId)).size!==all.length||ids.some(id=>!all.some(r=>r.runId===id)))throw new Error('F20_COMPARISON_LIMIT');
    const originals=ids.map(id=>source.receipts.find(r=>r.runId===id)),analysis=analyzeResearchRuns(originals,request.metric);
    comparison=analysis.comparison;snapshot=all;args={runs:analysis.runs,comparison,request,comparisons:Object.fromEntries(Object.keys(REGISTRY_METRICS).map(m=>[m,compareRunCollection(originals,m)]))};
    context={sourceKind:source.kind,stage:'fixed_validation',receipts:analysis.runs.map(r=>({runId:r.runId,revision:r.revision,title:r.title,...r.lineage,modelDigest:r.model.digest})),linkKind:'runs'};
    rowCount=analysis.runs.length;sourceCount=all.length;
  }else{
    if(def.family!=='research_selection')throw new Error('F20_SEARCH_SOURCE_REQUIRED');
    let receipt=null,search;
    if(source.kind==='f15-archived'){
      receipt=projectResearchRun(source.receipt);if(!receipt.selection)throw new Error('F20_ARCHIVED_SELECTION_REQUIRED');
      if(source.selection&&JSON.stringify(normalizeSearchEvidence(source.selection,{archived:true}))!==JSON.stringify(receipt.selection))throw new Error('F20_ARCHIVED_SELECTION_MISMATCH');
      search=receipt.selection;
    }else search=normalizeSearchEvidence(source.search);
    if(request.metric&&request.metric!==search.metric)throw new Error('F20_SEARCH_METRIC_MISMATCH');request.metric=search.metric;
    if(request.selectedTrialIndexes&&(!Array.isArray(input.selectedTrialIndexes)||request.selectedTrialIndexes.length>2||request.selectedTrialIndexes.some(i=>!Number.isInteger(i)||!search.trials.some(t=>t.configIndex===i))))throw new Error('F20_INVALID_TRIAL_SELECTION');
    snapshot={search,receipt};args={search,receipt,request};
    comparison={status:request.chartType==='cv_outer'?'contextual':'comparable',metric:search.metric,direction:search.direction,reasons:request.chartType==='cv_outer'?['Inner CV and fixed validation are distinct evaluation stages; no combined ranking.']:[],notes:['Same recorded inner-fold membership and metric definition.']};
    context={sourceKind:source.kind,stage:request.chartType==='cv_outer'?'distinct_cv_and_validation':'inner_cv',foldMembershipDigest:search.foldMembershipDigest,metricDefinitionVersion:1,linkKind:'trials',receipts:receipt?[{runId:receipt.runId,revision:receipt.revision,...receipt.lineage}]:[]};
    rowCount=search.trials.reduce((n,t)=>n+t.foldScores.length,0);sourceCount=search.trials.length*search.folds;
  }
  const snapshotDigest=await digest(snapshot),scopeDigest=await digest({snapshotDigest,request,scope:context.receipts});
  const adapter=await loadChartAdapter(request.chartType),result=adapter.compute(args);
  const spec={kind:'neuroforge-prism-chart',schemaVersion:2,registryVersion:CHART_REGISTRY_VERSION,chartId:crypto.randomUUID(),chartType:request.chartType,title:def.label,
    source:{name:source.kind==='f14-archive'?'Saved research receipts':source.kind==='f15-live'?'Recorded search session':'Archived selection summary',population:source.kind==='f14-archive'?'research_runs':'inner_cv_folds',datasetDigest:null,collectionDigest:snapshotDigest,scopeDigest,rowCount,sourceCount,unit:source.kind==='f14-archive'?'saved runs':'recorded inner-fold scores',pipelineDigest:null,datasetVersion:null},
    researchContext:{...context,snapshotDigest,comparisonScope:comparison},variables:{columns:result.evidence.columns.map(c=>c.key)},configuration:request,
    method:{name:request.chartType,implementationVersion:1,notes:result.notes,missingPolicy:'Unavailable records remain null; never substitute zero.'},visual:{palette:request.palette,showLabels:true,axisMin:null,axisMax:null},
    evidence:result.evidence,plot:result.plot,privacy:{observationLevel:false,rawIdsIncluded:false},exports:{python:true,javascript:true,summaryCsv:true,reproduction:'plot_data_only'}};
  validateChartSpec(spec);return {spec,links:result.links};
}
