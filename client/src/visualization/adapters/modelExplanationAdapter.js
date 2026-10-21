import {col,evidence} from '../chartEvidence.js';
import {classLabels} from './modelEvaluationAdapter.js';
export function compute({config,explanation,classes}){
  const type=config.type,result=explanation.result,rows=[],notes=[...(result.limitations||[]),result.explanation||'Uses completed F13 evidence. Descriptive model behavior; not causal, SHAP, fairness, or uncertainty evidence.'];
  let columns=[col('x','text'),col('y'),col('series','text')],plot={kind:'bar',xLabel:'Evidence',yLabel:'Measured value'},observationLevel=false;
  let stats={method:result.method,sampleCount:result.sampleCount??null,sourceCount:result.sourceCount??null};
  if(type==='model_importance'){
    columns=[...columns,col('sd'),col('low'),col('high'),col('repeats')];
    (result.features||[]).forEach(r=>rows.push({x:r.name,y:r.meanImportance,sd:r.standardDeviation,low:r.meanImportance-r.standardDeviation,high:r.meanImportance+r.standardDeviation,repeats:r.repeats,series:'Signed importance'}));
    plot={kind:'horizontal_error',xLabel:'Performance degradation ± repetition SD',yLabel:'Prepared feature',reference:'zero'};
    stats={...stats,metric:result.metric,baselineScore:result.baselineScore??null,repeats:result.repeats,seed:result.seed};
    notes.push('Signed importance: positive means worse permuted performance. Error bars are ± population SD across repetitions, not a confidence interval. Negative importance is retained.');
  }else if(type==='model_contributions'){
    observationLevel=true;columns=[...columns,col('start'),col('end')];
    let total=result.intercept;
    if(Number.isFinite(total)){
      rows.push({x:'Intercept',y:total,start:0,end:total,series:'Additive contribution'});
      for(const r of result.contributions){const start=total;total+=r.contribution;rows.push({x:r.feature,y:r.contribution,start,end:total,series:'Additive contribution'});}
      if(Math.abs(total-result.total)>1e-8*Math.max(1,Math.abs(total)))throw new Error('F19_CONTRIBUTION_RECONSTRUCTION');
      rows.push({x:'Reconstructed total',y:total,start:0,end:total,series:'Total'});
    }
    stats={...stats,scale:result.scale,total:result.total??null,reconstructed:result.reconstructed??null};
    plot={kind:'waterfall',xLabel:'Prepared feature contribution',yLabel:result.scale||'Model output'};
    notes.push('Ridge contributions add in target units; logistic adds log-odds; softmax adds one predicted-class logit. They are never additive probabilities.');
  }else if(type==='model_dependence'){
    observationLevel=!!result.curves?.length;columns=[col('x'),col('y'),col('series','text')];
    result.points.forEach(p=>rows.push({x:p.value,y:p.meanPrediction,series:'PDP mean'}));
    result.curves.forEach((curve,index)=>curve.values.forEach((y,i)=>rows.push({x:result.points[i].value,y,series:'ICE '+(index+1)})));
    stats={...stats,trainingRange:result.trainingRange};plot={kind:'line',xLabel:result.feature,yLabel:result.output};
    notes.push('Grid and sweep limits come from training values; the mean and ICE use the existing bounded validation background. ICE ordinals are session-local, not source identifiers.');
  }else if(type==='model_whatif'){
    observationLevel=true;
    if(result.originalProbabilities){classLabels(classes).forEach((name,i)=>{rows.push({x:name,y:result.originalProbabilities[i],series:'Original'});rows.push({x:name,y:result.hypotheticalProbabilities[i],series:'Hypothetical'});});}
    else rows.push({x:'Prediction',y:result.originalPrediction,series:'Original'},{x:'Prediction',y:result.hypotheticalPrediction,series:'Hypothetical'});
    stats={...stats,originalPrediction:result.originalPrediction,hypotheticalPrediction:result.hypotheticalPrediction,delta:result.regressionDelta};
    plot={kind:'bar',xLabel:result.originalProbabilities?'Fitted class':'Model output',yLabel:result.originalProbabilities?'Recorded class probability':'Predicted target'};
    notes.push('Hypothetical model response after frozen-pipeline source replay; not an intervention or causal effect.');
  }else if(type==='model_subgroups'){
    columns=[...columns,col('support')];result.groups.forEach(g=>rows.push({x:g.name,y:g.status==='ok'?g.metricValue:null,support:g.count,series:result.metric}));
    stats={...stats,trainingMedian:result.boundary,metric:result.metric};plot={kind:'bar',xLabel:'Training-median-defined group',yLabel:result.metric};
    notes.push('Insufficient-support groups remain unavailable; exact support appears in Data.');
  }else if(type==='model_model_specific'){
    observationLevel=true;
    if(result.decisions){
      columns=[col('x'),col('y'),col('label','text'),col('detail','text'),col('threshold'),col('direction','text')];
      result.decisions.forEach((d,i)=>rows.push({x:i,y:0,label:d.feature+' '+(d.direction==='left'?'≤':'>')+' '+d.threshold,detail:'Step '+(i+1)+' · '+d.direction,threshold:d.threshold,direction:d.direction}));
      rows.push({x:rows.length,y:0,label:'Leaf: '+String(result.modelOutput.predicted),detail:'Training leaf support: '+result.support,threshold:null,direction:'leaf'});
      plot={kind:'lineage',xLabel:'Exact fitted decision path',yLabel:'Sequential decisions'};stats.leafSupport=result.support;
    }
    else if(result.votes){result.votes.forEach((v,i)=>rows.push({x:classLabels(result.votes.map(r=>r.name))[i],y:v.count,series:result.treeCount?'Tree votes':'Neighbor votes'}));
      if(result.neighbors?.length){const ds=result.neighbors.map(n=>n.distance);stats.neighborDistances={count:ds.length,min:Math.min(...ds),max:Math.max(...ds),mean:ds.reduce((a,b)=>a+b,0)/ds.length};}
      plot={kind:'bar',xLabel:'Class',yLabel:'Vote count'};
    }else if(result.meanPrediction!==undefined)rows.push({x:'Mean fitted tree output',y:result.meanPrediction,series:'Forest aggregate'});
    else if(result.classPrior)result.classPrior.forEach((y,i)=>rows.push({x:classLabels(classes)[i],y,series:'Training class prior'}));
    else if(result.baseline!==null&&result.baseline!==undefined)rows.push({x:'Training-only mean',y:result.baseline,series:'Baseline'});
    notes.push('No neighbor identities, individual distances, training vectors, or source IDs are exported. Tree votes describe hard leaf decisions; forest probabilities can instead average leaf probabilities.');
  }else throw new Error('F19_UNSUPPORTED_EXPLANATION');
  const warnings=[];if(!rows.length)warnings.push(result.reason||'No faithful chart is available for this explanation and model family.');
  if(rows.some(r=>r.y===null))warnings.push('Some subgroup measures are unavailable; see support in Data.');
  return evidence({columns,rows,stats,notes,warnings,plot,kind:plot.kind,observationLevel,links:[]});
}
