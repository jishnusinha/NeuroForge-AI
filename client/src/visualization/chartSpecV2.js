import { digest } from '../../../shared/domain.mjs';
import { chartDefinition,loadChartAdapter,CHART_REGISTRY_VERSION } from './chartRegistry.js';
import { validateDataSheet } from '../ml/datasheet/gridModel.js';
import { validatePrismChartSpec } from './chartSpec.js';

export const CHART_SCHEMA_VERSION=2;
const populations=['source','filtered_source','selection','working_copy','prepared_pipeline','model_validation','model_test','model_train','research_runs','inner_cv_folds'];
export function validateChartConfig(config,headers,{pipeline=false}={}){
  if(!config||!headers?.length)throw new Error('F18_INVALID_CONFIGURATION');
  const def=chartDefinition(config.type);
  if(def.family.startsWith('research_'))throw new Error('F20_RESEARCH_CONTEXT_REQUIRED');
  if(['evaluation','explanation'].includes(def.family))throw new Error('F19_MODEL_CONTEXT_REQUIRED');
  if(def.family==='pipeline'&&!pipeline)throw new Error('F18_FROZEN_PIPELINE_REQUIRED');
  if(pipeline&&def.family!=='pipeline')throw new Error('F18_PIPELINE_CHART_REQUIRED');
  if(['distribution','relationship'].includes(def.family)&&(!config.x||!headers.includes(config.x)))throw new Error('F18_UNKNOWN_VARIABLE');
  if(['scatter','hexbin','trend'].includes(config.type)&&(!config.y||!headers.includes(config.y)))throw new Error('F18_UNKNOWN_VARIABLE');
  if(config.x&&!headers.includes(config.x)||config.y&&!headers.includes(config.y)||config.group&&!headers.includes(config.group))throw new Error('F18_UNKNOWN_VARIABLE');
  if(config.columns&&(!Array.isArray(config.columns)||config.columns.length>20||new Set(config.columns).size!==config.columns.length||config.columns.some(c=>!headers.includes(c))))throw new Error('F18_UNKNOWN_VARIABLE');
  if(config.bins!==undefined&&(!Number.isInteger(config.bins)||config.bins<4||config.bins>16))throw new Error('F18_INVALID_BINS');
  if(config.normalization&&!['count','frequency','density'].includes(config.normalization))throw new Error('F18_INVALID_NORMALIZATION');
  if(config.binning&&!['equal_width','sturges','freedman_diaconis'].includes(config.binning))throw new Error('F18_INVALID_BINNING');
  if(config.correlation&&!['pearson','spearman'].includes(config.correlation))throw new Error('F18_INVALID_CORRELATION');
  if(config.bandwidth!==undefined&&config.bandwidth!==null&&(!Number.isFinite(config.bandwidth)||config.bandwidth<=0))throw new Error('F18_INVALID_BANDWIDTH');
  if(config.palette&&!['prism','publication','diverging'].includes(config.palette))throw new Error('F18_INVALID_PALETTE');
  if(config.axisMin!==undefined&&config.axisMin!==null&&!Number.isFinite(config.axisMin)||config.axisMax!==undefined&&config.axisMax!==null&&!Number.isFinite(config.axisMax)||config.axisMin!=null&&config.axisMax!=null&&config.axisMin>=config.axisMax)throw new Error('F18_INVALID_AXIS_BOUNDS');
  return config;
}
export function validateChartSpec(spec){
  if(spec?.schemaVersion===1)return validatePrismChartSpec(spec);
  if(!spec||spec.kind!=='neuroforge-prism-chart'||spec.schemaVersion!==2||!spec.chartId||!spec.source||
     !(spec.researchContext?spec.source.datasetDigest===null&&/^[a-f0-9]{64}$/.test(spec.source.collectionDigest):/^[a-f0-9]{64}$/.test(spec.source.datasetDigest))||!/^[a-f0-9]{64}$/.test(spec.source.scopeDigest)||!populations.includes(spec.source.population)||
     !Number.isInteger(spec.source.rowCount)||spec.source.rowCount<0||spec.source.rowCount>2000||!spec.method||spec.method.implementationVersion!==1||
     !Number.isSafeInteger(spec.source.sourceCount)||spec.source.sourceCount<spec.source.rowCount||
     !Array.isArray(spec.evidence?.columns)||!Array.isArray(spec.evidence?.rows)||spec.evidence.rows.length>40000||
     !['ok','unavailable'].includes(spec.evidence.status)||!Array.isArray(spec.evidence.warnings)||!Array.isArray(spec.method.notes)||
     spec.source.sampling!==undefined&&(!spec.source.sampling||spec.source.sampling.kind!=='bounded_source_sample'||!Number.isSafeInteger(spec.source.sampling.populationCount)||spec.source.sampling.populationCount!==spec.source.sourceCount||!Number.isInteger(spec.source.sampling.plottedRows)||spec.source.sampling.plottedRows!==spec.source.rowCount))throw new Error('F18_INVALID_CHART_SPEC');
  const definition=chartDefinition(spec.chartType);
  if(definition.family.startsWith('research_')){
    const context=spec.researchContext;
    if(!context||!/^[a-f0-9]{64}$/.test(context.snapshotDigest)||context.snapshotDigest!==spec.source.collectionDigest||
       !['f14-archive','f15-live','f15-archived'].includes(context.sourceKind)||!['fixed_validation','inner_cv','distinct_cv_and_validation'].includes(context.stage)||
       !['comparable','contextual','unavailable'].includes(context.comparisonScope?.status)||!Array.isArray(context.comparisonScope.reasons)||
       !['research_runs','inner_cv_folds'].includes(spec.source.population)||spec.modelContext||spec.privacy?.observationLevel!==false||
       context.sourceKind==='f14-archive'&&spec.source.population!=='research_runs'||context.sourceKind!=='f14-archive'&&spec.source.population!=='inner_cv_folds')throw new Error('F20_INVALID_RESEARCH_PROVENANCE');
  }else if(spec.researchContext||['research_runs','inner_cv_folds'].includes(spec.source.population))throw new Error('F20_INVALID_RESEARCH_PROVENANCE');
  if(['evaluation','explanation'].includes(definition.family)){
    const context=spec.modelContext;
    if(!context||!['validation','test','train'].includes(context.split)||spec.source.population!=='model_'+context.split||context.split==='train'&&spec.chartType!=='training_loss'||
       !['regression','binary_classification','multiclass_classification'].includes(context.task)||
       !['candidateDigest','modelDigest','reportDigest','membershipDigest'].every(k=>/^[a-f0-9]{64}$/.test(context[k]))||
       context.split==='test'&&!context.finalAccessedAt||definition.family==='explanation'&&context.split!=='validation')throw new Error('F19_INVALID_MODEL_PROVENANCE');
  }else if(spec.modelContext||spec.source.population.startsWith('model_'))throw new Error('F19_INVALID_MODEL_PROVENANCE');
  if(!['bar','line','scatter','matrix','hexbin','heatmap','box','violin','lineage','range','horizontal_error','waterfall','fold_scores'].includes(spec.plot?.kind)||
     !['prism','publication','diverging'].includes(spec.visual?.palette)||typeof spec.privacy?.observationLevel!=='boolean')throw new Error('F18_INVALID_CHART_SPEC');
  const keys=spec.evidence.columns.map(c=>c.key);
  if(keys.length>32||new Set(keys).size!==keys.length||keys.some(k=>typeof k!=='string'||!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)||['id','rowId','__proto__','constructor','prototype'].includes(k))||
     spec.evidence.columns.some(c=>!['number','text'].includes(c.type)))throw new Error('F18_INVALID_EVIDENCE_SCHEMA');
  const types=new Map(spec.evidence.columns.map(c=>[c.key,c.type]));
  for(const row of spec.evidence.rows)for(const [key,value] of Object.entries(row)){
    if(!keys.includes(key)||value!=null&&(types.get(key)==='text'?typeof value!=='string':typeof value!=='number'||!Number.isFinite(value)))throw new Error('F18_INVALID_NUMERICAL_EVIDENCE');
  }
  const finiteTree=value=>typeof value==='number'?Number.isFinite(value):value&&typeof value==='object'?Object.values(value).every(finiteTree):true;
  if(!finiteTree(spec.evidence.stats))throw new Error('F18_INVALID_NUMERICAL_EVIDENCE');
  if(new TextEncoder().encode(JSON.stringify(spec)).length>6*1024*1024)throw new Error('F18_CHART_BUDGET');
  return spec;
}
export async function createChartSpec({dataset,config,population='source',sourceDataset=dataset,sourceName='Imported CSV',plan=null,selectionDigest=null,populationCount=sourceDataset?.rows?.length,sampling=null}){
  validateDataSheet(dataset);validateDataSheet(sourceDataset);
  const sourceRows=new Map(sourceDataset.rows.map(r=>[r.id,r]));
  if(dataset.headers.some(h=>!sourceDataset.headers.includes(h))||dataset.rows.some(row=>!sourceRows.has(row.id)||population!=='working_copy'&&dataset.headers.some(h=>!Object.is(row[h],sourceRows.get(row.id)[h]))))throw new Error('F18_SOURCE_POPULATION_MISMATCH');
  if(plan){
    if(!Array.isArray(plan.raw)||plan.raw.length!==dataset.rows.length||plan.raw.some((r,i)=>r.id!==dataset.rows[i].id||dataset.headers.some(h=>!Object.is(r[h],dataset.rows[i][h])))||
       JSON.stringify(plan.artifact?.membership)!==JSON.stringify(plan.membership))throw new Error('F18_PIPELINE_SOURCE_MISMATCH');
  }
  const headers=plan?[...new Set([...dataset.headers,...plan.outputFeatures])]:dataset.headers;
  validateChartConfig(config,headers,{pipeline:!!plan});
  if(!populations.includes(population))throw new Error('F18_INVALID_POPULATION');
  const adapter=await loadChartAdapter(config.type),result=adapter.compute({dataset,config,plan});
  let scopedDataset=dataset;
  if(plan&&!['pipeline_split','pipeline_lineage'].includes(config.type)&&config.partition!=='all'){
    const ids=new Set(plan.membership[config.partition||'train']);
    scopedDataset={headers:dataset.headers,rows:plan.raw.filter(row=>ids.has(row.id))};
  }
  const fingerprint=data=>digest({headers:data.headers,rows:data.rows.map(row=>({id:row.id,values:data.headers.map(h=>row[h]??null)}))});
  const [datasetDigest,scopeDigest,pipelineDigest]=await Promise.all([fingerprint(sourceDataset),fingerprint(scopedDataset),plan?digest(plan.artifact):null]);
  if(!Number.isSafeInteger(populationCount)||populationCount<sourceDataset.rows.length)throw new Error('F18_INVALID_POPULATION_COUNT');
  const samplingEvidence=populationCount>sourceDataset.rows.length?{...(sampling&&typeof sampling==='object'?structuredClone(sampling):{}),kind:'bounded_source_sample',populationCount,plottedRows:scopedDataset.rows.length}:undefined;
  const spec={kind:'neuroforge-prism-chart',schemaVersion:2,registryVersion:CHART_REGISTRY_VERSION,
    chartId:globalThis.crypto.randomUUID(),chartType:config.type,title:chartDefinition(config.type).label,
    source:{name:sourceName,datasetDigest,scopeDigest,population:plan?'prepared_pipeline':population,rowCount:scopedDataset.rows.length,
      sourceCount:populationCount,...(samplingEvidence?{sampling:samplingEvidence}:{}),selectionDigest,pipelineDigest,datasetVersion:sourceDataset.provenance?.versionId||null},
    variables:{x:config.x||null,y:config.y||null,group:config.group||null,columns:config.columns||dataset.headers},
    configuration:structuredClone(config),method:{name:config.type,missingPolicy:'explicit exclusions; see counts',implementationVersion:1,notes:result.notes},
    visual:{palette:config.palette||'prism',showLabels:config.showLabels!==false,axisMin:config.axisMin??null,axisMax:config.axisMax??null},
    evidence:result.evidence,plot:result.plot,privacy:{observationLevel:result.observationLevel,rawIdsIncluded:false},
    exports:{python:true,javascript:true,summaryCsv:!result.observationLevel,reproduction:'plot_data_only'}};
  validateChartSpec(spec);
  return {spec,links:result.links,scopedDataset};
}

export async function adaptV1Chart(spec,dataset){
  validatePrismChartSpec(spec);
  const result=await createChartSpec({dataset,config:{type:'histogram',x:spec.column,bins:spec.configuration.requestedBins},population:'filtered_source',sourceName:spec.sourceName});
  if(JSON.stringify(result.spec.evidence.rows.map(r=>[r.from,r.to,r.count]))!==JSON.stringify(spec.bins.map(b=>[b.from,b.to,b.count])))throw new Error('F18_V1_SCOPE_MISMATCH');
  return result;
}
