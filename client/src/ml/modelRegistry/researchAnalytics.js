import {validateRunReceipt} from './runContracts.js';
import {REGISTRY_METRICS,compareRunCollection} from './comparability.js';
import {normalizeSearchEvidence,researchConfiguration,finite} from '../modelSelection/searchAnalytics.js';
import {MODEL_DEFINITIONS} from '../modelWorkbench/models.js';
export function projectResearchRun(run){
  validateRunReceipt(run);
  if(typeof run.task.targetColumn!=='string'||!run.task.targetColumn||run.task.targetColumn.length>200||run.features.some(f=>f.length>200)||!MODEL_DEFINITIONS.some(d=>d.id===run.model.algorithm&&d.tasks.includes(run.task.type))||run.finalTest.accessHistory.some(e=>!Number.isFinite(Date.parse(e.accessedAt))))throw new Error('F20_INVALID_RECEIPT_METADATA');
  if(!Number.isFinite(Date.parse(run.createdAt))||!Number.isFinite(Date.parse(run.updatedAt))||Object.values(run.counts).reduce((n,v)=>n+v,0)>2000||
     run.task.classes.some(c=>typeof c!=='string'&&!finite(c))||new Set(run.task.classes).size!==run.task.classes.length||
     Object.entries(run.validation.metrics).some(([k,v])=>!['mse',...Object.keys(REGISTRY_METRICS)].includes(k)||v!==null&&!finite(v)))throw new Error('F20_INVALID_RECEIPT_MEASUREMENTS');
  const metrics=Object.fromEntries(Object.entries(REGISTRY_METRICS).filter(([,d])=>d.tasks.includes(run.task.type)).map(([k])=>[k,run.validation.metrics[k]??null]));
  if(run.task.type==='regression'&&Object.hasOwn(run.validation.metrics,'mse'))metrics.mse=run.validation.metrics.mse;
  if(Object.entries(metrics).some(([k,v])=>finite(v)&&(k!=='r2'&&v<0||['accuracy','macroF1','weightedF1','precision','recall','f1'].includes(k)&&v>1)))throw new Error('F20_INVALID_RECEIPT_MEASUREMENTS');
  const config=researchConfiguration(run.model.config);
  const selection=run.selectionEvidence?normalizeSearchEvidence(run.selectionEvidence,{archived:true}):null;
  if(selection){const chosen=selection.trials.find(t=>t.configIndex===selection.selectedIndex);
    if(selection.sourceTrainingCount!==run.counts.train||Object.entries(chosen.configuration).some(([k,v])=>config[k]!==v))throw new Error('F20_ARCHIVED_SELECTION_MISMATCH');}
  return {runId:run.runId,revision:run.revision,title:run.title,tags:[...run.tags],createdAt:run.createdAt,updatedAt:run.updatedAt,
    task:{type:run.task.type,targetColumn:run.task.targetColumn,classes:[...run.task.classes]},features:[...run.features],lineage:Object.fromEntries(['sourceDigest','splitDigest','pipelineDigest','featureSchemaDigest'].map(k=>[k,run.lineage[k]])),
    model:{algorithm:run.model.algorithm,digest:run.model.digest,configuration:config},validation:{count:run.validation.count,metricDefinitionVersion:run.validation.metricDefinitionVersion,metrics},
    counts:{train:run.counts.train,validation:run.counts.validation,test:run.counts.test},
    finalTestAudit:run.finalTest.accessHistory.map(e=>({accessedAt:e.accessedAt,count:e.count})),selection};
}
export function analyzeResearchRuns(runs,metric){
  const projected=runs.map(projectResearchRun),comparison=compareRunCollection(runs,metric);
  return {runs:projected,comparison};
}
export function filterResearchRuns(runs,{query='',task='all',algorithm='all',tag='all',source='all',population='all'}={}){
  return runs.filter(r=>(task==='all'||r.task.type===task)&&(algorithm==='all'||r.model.algorithm===algorithm)&&(tag==='all'||r.tags.includes(tag))&&
    (source==='all'||r.lineage.sourceDigest===source)&&(population==='all'||r.lineage.splitDigest===population)&&
    (r.title+' '+r.model.algorithm+' '+r.tags.join(' ')).toLowerCase().includes(query.toLowerCase().trim()));
}
