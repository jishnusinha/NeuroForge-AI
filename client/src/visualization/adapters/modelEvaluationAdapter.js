import {col,evidence} from '../chartEvidence.js';
const columns=[col('x'),col('y'),col('series','text')];
const sum=xs=>xs.reduce((a,b)=>a+b,0);
export const classLabels=classes=>new Set(classes.map(String)).size===classes.length?classes.map(String):classes.map((c,i)=>'Class '+(i+1)+': '+String(c)+' ('+typeof c+')');
// Threshold ties enter together. PR area is non-interpolated average precision,
// deliberately distinct from the trapezoidal ROC integral.
export function probabilityDiagnostics(report,classes,classIndex=classes.length-1){
  if(!Number.isInteger(classIndex)||classIndex<0||classIndex>=classes.length)throw new Error('F19_UNKNOWN_CLASS');
  if(!report?.evidence?.length||report.evidence.length>2000||report.evidence.some(r=>!classes.includes(r.target)||!Array.isArray(r.probabilities)||r.probabilities.length!==classes.length||r.probabilities.some(p=>typeof p!=='number'||!Number.isFinite(p)||p<0||p>1)||Math.abs(sum(r.probabilities)-1)>1e-8))throw new Error('F19_INVALID_RECORDED_PROBABILITY');
  const points=report.evidence.map(r=>({score:r.probabilities[classIndex],positive:r.target===classes[classIndex]})).sort((a,b)=>b.score-a.score);
  const n=points.length,positive=points.filter(r=>r.positive).length,negative=n-positive;
  let tp=0,fp=0,auc=0,ap=0,previousFpr=0,previousRecall=0;
  const curve=[{threshold:null,tp:0,fp:0,fpr:negative?0:null,recall:positive?0:null,precision:null}];
  for(let i=0;i<n;){const threshold=points[i].score;do{if(points[i].positive)tp++;else fp++;i++;}while(i<n&&points[i].score===threshold);
    const fpr=negative?fp/negative:null,recall=positive?tp/positive:null,precision=tp/(tp+fp);
    if(positive&&negative)auc+=(fpr-previousFpr)*(recall+previousRecall)/2;
    if(positive)ap+=(recall-previousRecall)*precision;
    curve.push({threshold,tp,fp,fpr,recall,precision});previousFpr=fpr;previousRecall=recall;
  }
  const bins=Array.from({length:10},(_,i)=>{const selected=points.filter(r=>Math.min(9,Math.floor(r.score*10))===i),count=selected.length;
    return {from:i/10,to:(i+1)/10,count,mean:count?sum(selected.map(r=>r.score))/count:null,observed:count?selected.filter(r=>r.positive).length/count:null};});
  return {curve,bins,positive,negative,prevalence:positive/n,auc:positive&&negative?auc:null,averagePrecision:positive?ap:null,
    brier:sum(points.map(r=>(r.score-Number(r.positive))**2))/n,
    ece:sum(bins.filter(b=>b.count).map(b=>b.count/n*Math.abs(b.mean-b.observed)))};
}
export function compute({report,config,classes,trainingTrace=null,trainingCount=0}){
  const type=config.type,rows=[],links=[],notes=['Uses the recorded F12 report; no predictions, fitting, splits, or test access are performed by this adapter.'],stats={...report.metrics,count:report.count};
  let plot={kind:'bar',xLabel:'Measured category',yLabel:'Value'},observationLevel=false,cols=columns;
  const add=(row,ids=[])=>{rows.push(row);links.push(ids);};
  const labels=classLabels(classes);
  if(['roc','precision_recall','calibration','confidence'].includes(type)&&report.evidence.some(r=>!r.probabilities))return evidence({columns,rows:[],notes:[...notes,'Recorded class probabilities are unavailable; no scores are inferred from predicted labels.'],warnings:['Recorded probabilities are required for this diagnostic.'],plot:{kind:'line',xLabel:'Probability diagnostic',yLabel:'Unavailable'}});
  if(['actual_predicted','residuals'].includes(type)){
    observationLevel=true;plot={kind:'scatter',xLabel:type==='residuals'?'Fitted target':'Actual target',yLabel:type==='residuals'?'Residual (actual − predicted)':'Predicted target',reference:type==='residuals'?'zero':'identity'};
    report.evidence.forEach(r=>add({x:type==='residuals'?r.predicted:r.target,y:type==='residuals'?r.residual:r.predicted,series:'Recorded predictions'},[r.id]));
  }else if(['residual_distribution','error_range'].includes(type)){
    const values=report.evidence.map(r=>type==='residual_distribution'?r.residual:r.target),low=Math.min(...values),high=Math.max(...values),count=low===high?1:8,width=(high-low)/count||1;
    cols=[col('x','text'),col('y'),col('from'),col('to'),col('count'),col('series','text')];
    for(let i=0;i<count;i++){const subset=report.evidence.filter((_,j)=>Math.min(count-1,Math.floor((values[j]-low)/width))===i);
      add({x:'Bin '+(i+1),from:low+i*width,to:low===high?high:low+(i+1)*width,count:subset.length,y:type==='residual_distribution'?subset.length:subset.length?sum(subset.map(r=>Math.abs(r.residual)))/subset.length:null,series:type==='residual_distribution'?'Signed residual counts':'Mean absolute error'},subset.map(r=>r.id));}
    plot={kind:'bar',xLabel:type==='residual_distribution'?'Signed residual range (see Data)':'Actual target range (see Data)',yLabel:type==='residual_distribution'?'Count':'Mean absolute error'};
    notes.push('Eight equal-width bins; constant values use one bin. Left closed/right open, final bin includes maximum. Empty error bins are unavailable. Residual = actual − predicted; no normality assumption.');
  }else if(type==='confusion'){
    cols=[col('x','text'),col('y','text'),col('value'),col('count'),col('support')];
    report.confusion.forEach((rr,i)=>rr.forEach((n,j)=>add({x:labels[j],y:labels[i],count:n,support:report.perClass[i].support,value:config.rowNormalized?(report.perClass[i].support?n/report.perClass[i].support:null):n})));
    plot={kind:'heatmap',scaleMax:config.rowNormalized?1:Math.max(1,...report.confusion.flat()),scaleName:config.rowNormalized?'Within true class fraction':'Count',xLabel:'Predicted class',yLabel:'True class'};
    notes.push('True classes on rows; predicted classes on columns. Row normalization divides by true class support; zero support is unavailable.');
  }else if(type==='per_class'){
    cols=[col('x','text'),col('y'),col('support'),col('series','text')];
    report.perClass.forEach((r,i)=>['precision','recall','f1'].forEach(metric=>add({x:labels[i],y:r[metric],support:r.support,series:metric})));
    plot={kind:'bar',xLabel:'Class',yLabel:'Recorded metric'};
  }else if(['roc','precision_recall','calibration'].includes(type)){
    const d=probabilityDiagnostics(report,classes,config.classIndex??classes.length-1);Object.assign(stats,{class:String(classes[config.classIndex??classes.length-1]),positive:d.positive,negative:d.negative,prevalence:d.prevalence,auc:d.auc,averagePrecision:d.averagePrecision,brier:d.brier,ece:d.ece});
    cols=[...columns,col('threshold'),col('support'),col('from'),col('to')];
    if(type==='calibration'){
      d.bins.forEach(b=>add({x:b.mean,y:b.observed,support:b.count,from:b.from,to:b.to,threshold:null,series:'Reliability bins'}));
      plot={kind:'scatter',reference:'identity',xLabel:'Mean recorded class probability',yLabel:'Observed class fraction'};
    }else{
      d.curve.forEach(p=>add({x:type==='roc'?p.fpr:p.recall,y:type==='roc'?p.recall:p.precision,threshold:p.threshold,support:p.tp+p.fp,from:null,to:null,series:'One-vs-rest'}));
      plot={kind:'line',xLabel:type==='roc'?'False positive rate':'Recall',yLabel:type==='roc'?'True positive rate':'Precision'};
      if(type==='roc'&&d.auc===null||type==='precision_recall'&&!d.positive)rows.length=links.length=0;
    }
    notes.push('One-vs-rest class chosen from the fitted class order. Equal scores enter as one threshold group. ROC AUC uses trapezoids; PR summary is non-interpolated average precision. No predicted positives gives unavailable precision. ROC requires both outcomes; PR requires positives.',
      'Calibration uses ten [left,right) probability bins (last includes 1). Empty bins unavailable. Brier = mean squared one-vs-rest probability error. ECE = sum bin_count/N × |mean_probability − observed_fraction|.');
  }else if(type==='confidence'){
    cols=[col('x','text'),col('y'),col('series','text'),col('from'),col('to'),col('count')];
    for(let i=0;i<10;i++)for(const correct of [true,false]){const subset=report.evidence.filter(r=>r.correct===correct&&Math.min(9,Math.floor(Math.max(...r.probabilities)*10))===i);add({x:'['+(i/10).toFixed(1)+', '+((i+1)/10).toFixed(1)+(i===9?']':')'),y:subset.length,count:subset.length,from:i/10,to:(i+1)/10,series:correct?'Correct':'Incorrect'},subset.map(r=>r.id));}
    plot={kind:'bar',xLabel:'Maximum recorded class probability bin',yLabel:'Count'};
    notes.push('Model-reported confidence is not a calibrated real-world uncertainty guarantee. Ten probability bins; last includes 1.');
  }else if(type==='training_loss'){
    Object.keys(stats).forEach(k=>delete stats[k]);Object.assign(stats,{count:trainingCount,epochs:trainingTrace?.points.length??0});
    if(trainingTrace)trainingTrace.points.forEach(p=>add({x:p.epoch,y:p.loss,series:'Training objective'}));
    plot={kind:'line',xLabel:'Completed training epoch',yLabel:'Training cross-entropy + L2 penalty'};
    notes.push('Measured after each completed iterative update, on training rows only. No validation/test loss is calculated. Closed-form, neighbor, baseline and tree models have no epoch trace.');
  }else throw new Error('F19_UNSUPPORTED_EVALUATION');
  const warnings=[];if(!rows.length)warnings.push('This diagnostic is unavailable for the recorded outcomes or training method.');
  if(rows.some(r=>r.y===null||r.value===null))warnings.push('Undefined measures and empty bins remain unavailable; inspect Data for exact support.');
  return evidence({columns:cols,rows,stats,warnings,plot,kind:plot.kind,links,observationLevel,notes});
}
