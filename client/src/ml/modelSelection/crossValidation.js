import { createInnerFolds } from './folds.js';
import { prepareInnerFold } from './foldPipeline.js';
import { validateSearchRequest } from './searchManifest.js';
import { fitWorkbenchModel, predictWorkbenchModel } from '../modelWorkbench/models.js';
import { evaluateWorkbenchPredictions } from '../modelWorkbench/metrics.js';
import { digest } from '../../../../shared/domain.mjs';
const mean=values=>values.reduce((s,v)=>s+v,0)/values.length;
const sd=values=>values.length>1?Math.sqrt(values.reduce((s,v)=>s+(v-mean(values))**2,0)/(values.length-1)):null;
/**
 * F15 inner-CV search, completely within original F11 training membership.
 * All fold pipelines are re-fitted from RAW training input values.
 * No global preprocessed matrix is ever used as a fold-training input.
 */
export async function runModelSearch(plan,outerMatrix,{
  algorithm,folds=3,seed=42,metric=null,configs=null,
}={},onProgress=()=>{},signal=null) {
  const request=validateSearchRequest(outerMatrix.task.type,algorithm,{folds,seed,metric,configs});
  if(!plan?.recipe||!Array.isArray(plan.raw)||!outerMatrix?.membership?.train||
     plan.raw.some(row=>typeof row.id!=='string'))
    throw new Error('F15_SOURCE_REQUIRED');
  const originalTraining=new Set(outerMatrix.membership.train);
  const raw=plan.raw.filter(row=>originalTraining.has(row.id));
  if(raw.length!==originalTraining.size)throw new Error('F15_SOURCE_MEMBERSHIP_MISMATCH');
  const partitions=createInnerFolds(raw,outerMatrix.membership.train,plan.recipe.targetColumn,
    outerMatrix.task.type,{folds,seed});
  // Keep even the immutable outer validation/test *identities* out of the
  // prepared data. Raw labels from those partitions are never referenced.
  const safePlan={recipe:structuredClone(plan.recipe),raw:raw.map(row=>({...row}))};
  const foldMatrices=partitions.map(fold=>prepareInnerFold(safePlan,outerMatrix,fold));
  const foldDigest=await digest(partitions);
  const results=[];
  let completed=0;
  for(let configIndex=0;configIndex<request.configs.length;configIndex++){
    const config={...request.configs[configIndex]};
    const foldScores=[];
    const foldCounts=[];
    let failure=null;
    for(const matrix of foldMatrices){
      if(signal?.aborted)throw new Error('F15_SEARCH_CANCELLED');
      try {
        const model=fitWorkbenchModel(matrix,algorithm,config);
        const selected=matrix.rows.filter(row=>row.split==='validation');
        const predictions=predictWorkbenchModel(model,selected.map(row=>row.values));
        const report=evaluateWorkbenchPredictions(matrix,predictions,'validation');
        const score=report.metrics[request.metric];
        if(typeof score!=='number'||!Number.isFinite(score)){
          failure='The selected metric is unavailable on at least one fold.';
          break;
        }
        foldScores.push(score);
        foldCounts.push(selected.length);
      }catch(error){
        failure=error.message;
        break;
      }finally{
        completed++;
        onProgress({completed,total:request.configs.length*folds,
          configIndex,foldIndex:matrix.lineage.foldIndex,snapshot:{kind:'neuroforge-f15-search',schemaVersion:1,scope:'original-training-inner-cv',algorithm,task:outerMatrix.task.type,metric:request.metric,direction:request.direction,folds,seed,foldMembershipDigest:foldDigest,sourceTrainingCount:raw.length,status:'running',selectedIndex:null,results:[...results.map(r=>structuredClone(r)),{configIndex,configuration:{...config},status:'incomplete',foldScores:[...foldScores],foldCounts:[...foldCounts],mean:null,sampleSd:null,reason:null}]}});
      }
    }
    results.push({
      configIndex,configuration:config,status:failure?'unavailable':'complete',
      foldScores,foldCounts,foldsCompleted:foldScores.length,
      mean:failure?null:mean(foldScores),
      sampleSd:failure?null:sd(foldScores),
      reason:failure,
    });
  }
  const eligible=results.filter(item=>item.status==='complete');
  const ranked=[...eligible].sort((a,b)=>{
    const delta=request.direction==='maximize'?b.mean-a.mean:a.mean-b.mean;
    return delta||a.configIndex-b.configIndex;
  });
  return {
    kind:'neuroforge-f15-search',schemaVersion:1,scope:'original-training-inner-cv',
    algorithm,task:outerMatrix.task.type,metric:request.metric,
    direction:request.direction,folds,seed,foldMembershipDigest:foldDigest,
    sourceTrainingCount:raw.length,
    totalFits:request.configs.length*folds,
    completedFits:completed,
    results,selectedIndex:ranked[0]?.configIndex??null,
    status:ranked.length?'complete':'unavailable',
    limitations:[
      'Fold membership and all learned F11 preprocessing are fitted strictly on the original training partition.',
      'Fold variability is descriptive, not a confidence interval or evidence of statistical significance.',
      'Original F11 validation and test observations are never included in inner CV.',
      'A selected configuration must still be refitted on the full original training partition and checked on fixed validation.',
    ],
  };
}
