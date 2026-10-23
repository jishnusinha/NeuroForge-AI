import {digest} from '../../../shared/domain.mjs';
import {chartDefinition,loadChartAdapter,CHART_REGISTRY_VERSION} from './chartRegistry.js';
import {validateChartSpec} from './chartSpecV2.js';
import {evaluateWorkbenchPredictions} from '../ml/modelWorkbench/metrics.js';
import {MODEL_DEFINITIONS} from '../ml/modelWorkbench/models.js';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validateModelReport({matrix,candidate,report,finalTest=null}){
  if(matrix?.schemaVersion!==1||!matrix?.task||!Array.isArray(matrix.rows)||!Array.isArray(matrix.features)||!matrix?.membership||typeof candidate?.id!=='string'||!candidate.id||candidate.model?.kind!=='neuroforge-f12-model'||candidate.model.schemaVersion!==1||!report||!Array.isArray(report.evidence)||!['validation','test'].includes(report.split)||
     report.task!==matrix.task.type||candidate.model.task!==matrix.task.type||!equal(candidate.model.features,matrix.features)||!equal(candidate.model.classes,matrix.task.classes))throw new Error('F19_MODEL_CONTEXT_MISMATCH');
  if(!MODEL_DEFINITIONS.some(d=>d.id===candidate.model.algorithm&&d.tasks.includes(matrix.task.type))||!Array.isArray(matrix.task.classes)||
     new Set(matrix.task.classes).size!==matrix.task.classes.length||matrix.task.classes.some(c=>typeof c!=='string'&&!finite(c)))throw new Error('F19_MODEL_CONTEXT_MISMATCH');
  const allIds=['train','validation','test'].flatMap(split=>matrix.membership[split]||[]);
  if(matrix.rows.length>2000||allIds.length!==matrix.rows.length||new Set(allIds).size!==allIds.length||new Set(matrix.rows.map(r=>r.id)).size!==allIds.length||
     matrix.rows.some(r=>!matrix.membership[r.split]?.includes(r.id))||candidate.algorithm!==candidate.model.algorithm||candidate.model.trainingCount!==matrix.membership.train.length)throw new Error('F19_MEMBERSHIP_MISMATCH');
  if(report.split==='validation'&&report!==candidate.validation)throw new Error('F19_RECORDED_REPORT_REQUIRED');
  if(report.split==='test'&&(!finalTest||finalTest.candidateId!==candidate.id||finalTest.report!==report||!Number.isFinite(Date.parse(finalTest.accessedAt))))throw new Error('F19_FINAL_TEST_SEALED');
  const selected=matrix.rows.filter(r=>r.split===report.split),ids=matrix.membership[report.split];
  if(selected.length!==ids.length||report.count!==selected.length||report.evidence.length!==selected.length||selected.length<1||selected.length>2000||new Set(ids).size!==ids.length)throw new Error('F19_MEMBERSHIP_MISMATCH');
  report.evidence.forEach((r,i)=>{const expected=selected[i];
    if(r.id!==expected.id||!ids.includes(r.id)||r.split!==report.split||!Object.is(r.target,expected.target))throw new Error('F19_MEMBERSHIP_MISMATCH');
    if(matrix.task.type==='regression'){
      if(!finite(r.target)||!finite(r.predicted)||!finite(r.residual)||Math.abs(r.residual-(r.target-r.predicted))>1e-10)throw new Error('F19_INVALID_RECORDED_OUTPUT');
    }else if(!matrix.task.classes.includes(r.target)||!matrix.task.classes.includes(r.predicted)||r.probabilities!=null&&(!Array.isArray(r.probabilities)||r.probabilities.length!==matrix.task.classes.length||r.probabilities.some(v=>!finite(v)||v<0||v>1)||Math.abs(r.probabilities.reduce((a,b)=>a+b,0)-1)>1e-8||matrix.task.classes[r.probabilities.indexOf(Math.max(...r.probabilities))]!==r.predicted)||r.correct!==(r.predicted===r.target))throw new Error('F19_INVALID_RECORDED_PROBABILITY');
  });
  // Check internal numerical consistency from recorded predictions only. No scoring API.
  const measured=evaluateWorkbenchPredictions(matrix,report.evidence.map(r=>({predicted:r.predicted,probabilities:r.probabilities})),report.split);
  if(!equal(measured.metrics,report.metrics)||!equal(measured.confusion,report.confusion)||!equal(measured.perClass,report.perClass))throw new Error('F19_REPORT_EVIDENCE_MISMATCH');
  return selected;
}
export async function createModelChartSpec({matrix,candidate,config,report=candidate?.validation,finalTest=null,explanation=null}){
  if(!config||Object.keys(config).some(k=>!['type','classIndex','rowNormalized','palette'].includes(k))||config.palette&&!['prism','publication','diverging'].includes(config.palette)||config.rowNormalized!==undefined&&typeof config.rowNormalized!=='boolean')throw new Error('F19_INVALID_CONFIGURATION');
  const selected=validateModelReport({matrix,candidate,report,finalTest}),def=chartDefinition(config.type),regression=matrix.task.type==='regression';
  if(!['evaluation','explanation'].includes(def.family))throw new Error('F19_MODEL_CHART_REQUIRED');
  if(def.family==='explanation'&&(report.split!=='validation'||!explanation||explanation.candidateId!==candidate.id||explanation.model!==candidate.model||!explanation.result))throw new Error('F19_EXPLANATION_CONTEXT_MISMATCH');
  const regressionTypes=['actual_predicted','residuals','residual_distribution','error_range'];
  if(def.family==='evaluation'&&config.type!=='training_loss'&&(regressionTypes.includes(config.type)!==regression))throw new Error('F19_INCOMPATIBLE_TASK');
  if(config.classIndex!==undefined&&(!Number.isInteger(config.classIndex)||config.classIndex<0||config.classIndex>=matrix.task.classes.length))throw new Error('F19_UNKNOWN_CLASS');
  if(config.type==='training_loss'&&candidate.trainingTrace&&(!['logistic','softmax'].includes(candidate.model.algorithm)||report.split!=='validation'||
     !Array.isArray(candidate.trainingTrace.points)||candidate.trainingTrace.points.length!==candidate.model.parameters.epochs||
     candidate.trainingTrace.points.some((p,i)=>p.epoch!==i+1||!finite(p.loss)||p.loss<0)))throw new Error('F19_INVALID_TRAINING_TRACE');
  if(explanation?.result.rowId&&!matrix.membership.validation.includes(explanation.result.rowId)||explanation?.result.curves?.some(c=>!matrix.membership.validation.includes(c.rowId)))throw new Error('F19_EXPLANATION_SCOPE_MISMATCH');
  if(explanation?.result.algorithm&&explanation.result.algorithm!==candidate.model.algorithm)throw new Error('F19_EXPLANATION_CONTEXT_MISMATCH');
  const adapter=await loadChartAdapter(config.type),result=adapter.compute({report,config,classes:matrix.task.classes,trainingTrace:candidate.trainingTrace,trainingCount:candidate.model.trainingCount,explanation});
  const split=config.type==='training_loss'?'train':report.split;
  const [datasetDigest,scopeDigest,pipelineDigest,modelDigest,reportDigest,membershipDigest]=await Promise.all([
    digest({features:matrix.features,membership:matrix.membership,lineage:matrix.lineage}),digest(config.type==='training_loss'?candidate.trainingTrace??null:report.evidence),digest(matrix.lineage.fittedPipeline),digest(candidate.model),digest(report),digest(matrix.membership[split])]);
  const candidateDigest=await digest({candidateId:candidate.id,modelDigest,reportDigest});
  const spec={kind:'neuroforge-prism-chart',schemaVersion:2,registryVersion:CHART_REGISTRY_VERSION,chartId:crypto.randomUUID(),chartType:config.type,title:def.label,
    source:{name:candidate.algorithm+' · '+split,datasetDigest,scopeDigest,pipelineDigest,population:'model_'+split,rowCount:split==='train'?matrix.membership.train.length:selected.length,sourceCount:matrix.rows.length,datasetVersion:null,selectionDigest:null},
    modelContext:{candidateDigest,modelDigest,reportDigest,membershipDigest,task:matrix.task.type,algorithm:candidate.algorithm,split,sourceReportSplit:report.split,classes:[...matrix.task.classes],finalAccessedAt:report.split==='test'?finalTest.accessedAt:null},
    variables:{columns:[...matrix.features]},configuration:{...config},method:{name:config.type,implementationVersion:1,notes:result.notes,missingPolicy:'Unavailable denominators remain null.'},
    visual:{palette:config.palette||'prism',showLabels:true,axisMin:null,axisMax:null},evidence:result.evidence,plot:result.plot,
    privacy:{observationLevel:result.observationLevel,rawIdsIncluded:false},exports:{python:true,javascript:true,summaryCsv:!result.observationLevel,reproduction:'plot_data_only'}};
  validateChartSpec(spec);return {spec,links:result.links};
}
