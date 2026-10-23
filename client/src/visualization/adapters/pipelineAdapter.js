import { replayFittedStages } from '../../ml/pipelineExecutor.js';
import { distributionEvidence } from '../../ml/edaStatistics.js';
import { isMissingValue } from '../../ml/edaFilters.js';
import { numericValues,summary,evidence,col,finite } from '../chartEvidence.js';

export function compute({config,plan}){
  if(!plan?.artifact||!plan?.raw||!plan?.membership)throw new Error('F18_FROZEN_PIPELINE_REQUIRED');
  const stages=replayFittedStages(plan.artifact,plan.raw),stage=stages.find(s=>s.id===config.stage)||stages.at(-1);
  const {type,partition='train',x}=config;
  if(!['train','validation','test','all'].includes(partition))throw new Error('F18_INVALID_PARTITION');
  const ids=new Set(partition==='all'?plan.raw.map(r=>r.id):plan.membership[partition]);
  const before=(stage?.before||plan.raw).filter(r=>ids.has(r.id)),after=(stage?.after||plan.rows).filter(r=>ids.has(r.id));
  const rows=[],warnings=[],stats={partition,rows:ids.size,stage:stage?.id||'identity',trainingFitCount:plan.membership.train.length,droppedRows:0};
  let kind='bar';
  if(type==='pipeline_distribution'){
    for(const [phase,population] of [['Before',before],['After',after]]){
      const result=distributionEvidence(population,x,'numeric',config.bins||8);
      result.bins.forEach((b,i)=>rows.push({series:phase,x:i+1,y:b.count,from:b.from,to:b.to,count:b.count}));
    }
  }else if(type==='pipeline_scaling'){
    kind='range';
    for(const column of (stage?.columns||plan.outputFeatures))for(const [phase,population] of [['Before',before],['After',after]]){
      const s=summary(numericValues(population,column));if(s.count)rows.push({series:phase,x:column,y:s.mean,min:s.min,max:s.max,mean:s.mean,count:s.count,sd:s.sd});
    }
  }else if(type==='pipeline_missingness'||type==='pipeline_invalid'){
    const columns=[...new Set([...(stage?.inputFeatures||plan.recipe.featureColumns),...(stage?.outputFeatures||plan.outputFeatures)])];
    for(const column of columns)for(const [phase,population] of [['Before',before],['After',after]]){
      const absent=population.filter(r=>!Object.hasOwn(r,column)).length;
      const missing=population.filter(r=>Object.hasOwn(r,column)&&isMissingValue(r[column])).length;
      const invalid=population.filter(r=>Object.hasOwn(r,column)&&!isMissingValue(r[column])&&!finite(r[column])).length;
      rows.push({series:phase,x:column,y:type==='pipeline_missingness'?missing:absent+invalid,count:population.length,missing,absent,nonNumeric:invalid,
        observed:population.length-absent-missing,imputed:phase==='After'?before.filter((r,i)=>Object.hasOwn(r,column)&&isMissingValue(r[column])&&!isMissingValue(population[i]?.[column])).length:0});
    }
  }else if(type==='pipeline_expansion'){
    for(const column of stage?.inputFeatures||plan.recipe.featureColumns)rows.push({series:'Input',x:column,y:1,count:ids.size});
    for(const column of stage?.outputFeatures||plan.outputFeatures)rows.push({series:(stage?.inputFeatures||[]).includes(column)?'Retained output':'Generated output',x:column,y:1,count:ids.size});
  }else if(type==='pipeline_split'){
    for(const partition of ['train','validation','test']){
      const membership=new Set(plan.membership[partition]),counts=new Map();
      for(const row of plan.raw.filter(r=>membership.has(r.id))){const label=plan.recipe.taskType==='regression'?'All targets':String(row[plan.recipe.targetColumn]);counts.set(label,(counts.get(label)||0)+1);}
      for(const [label,count] of counts)rows.push({series:label,x:partition,y:count,count,denominator:membership.size});
    }
  }else if(type==='pipeline_lineage'){
    kind='lineage';
    rows.push({x:0,y:0,label:'Source inputs',detail:plan.recipe.featureColumns.join(', '),series:'Lineage',count:plan.recipe.featureColumns.length});
    stages.forEach((s,i)=>rows.push({x:i+1,y:0,label:s.type,detail:'Input: '+s.inputFeatures.join(', ')+' | Output: '+s.outputFeatures.join(', '),series:'Lineage',count:s.outputFeatures.length}));
  }else{
    for(const [column,parameters] of Object.entries(stage?.parameters||{})){
      for(const [parameter,value] of Object.entries(parameters)){
        if(finite(value))rows.push({series:column,x:parameter,y:value,count:plan.membership.train.length,detail:'Existing training-fitted statistic'});
        else if(typeof value==='string'||Array.isArray(value))warnings.push(column+' · '+parameter+': '+(Array.isArray(value)?value.join(', '):value));
      }
    }
    if(!rows.length)warnings.push('This stage has no numerical fitted parameters (for example, deterministic feature engineering). See lineage and feature expansion.');
  }
  stats.inputFeatures=stage?.inputFeatures||plan.recipe.featureColumns;stats.outputFeatures=stage?.outputFeatures||plan.outputFeatures;
  return evidence({columns:[col('series','text'),col('x',type==='pipeline_distribution'||type==='pipeline_lineage'?'number':'text'),col('y'),col('from'),col('to'),col('count'),col('min'),col('max'),col('mean'),col('sd'),col('missing'),col('absent'),col('nonNumeric'),col('observed'),col('imputed'),col('denominator'),col('label','text'),col('detail','text')],rows,kind,stats,warnings,
    notes:['Every stage replays applyFittedNode using the existing fitted artifact. No fitting, split creation, model evaluation, or test-access operation is invoked.',
      'Before/after measurements use the identical selected partition and stable row order. Absent columns after one-hot encoding are distinguished from missing cells; categorical non-numeric values are unavailable to numeric plots, not necessarily invalid data.',
      'The pipeline retains all observations. Dropped-row count is zero; generated/removed feature columns are shown explicitly. Scaling ranges and means are measured after applying the frozen stage.',
      'Before/after histograms have independently measured equal-width bin edges, exported exactly; their ranges can differ. Split composition is descriptive, not a model validation score.'],
    plot:{histogram:type==='pipeline_distribution',range:type==='pipeline_scaling',xLabel:type==='pipeline_distribution'?x+' · numbered bins':'Stage / column',yLabel:type==='pipeline_scaling'?'Measured mean (ranges in data table)':'Measured value / count'}});
}
