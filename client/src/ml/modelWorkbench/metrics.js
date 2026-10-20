/**
 * Pure task-aware metric definitions. Undefined measures remain null.
 * Never infer probabilities or impute held-out ground truth.
 */
const divide=(top,bottom)=>bottom===0?null:top/bottom;
const average=values=>values.length?values.reduce((sum,v)=>sum+v,0)/values.length:null;
export function evaluateWorkbenchPredictions(matrix,predictions,split='validation') {
  const rows=matrix.rows.filter(row=>row.split===split);
  if(!rows.length||rows.length!==predictions.length)throw new Error('F12_EVALUATION_MISMATCH');
  const evidence=rows.map((row,i)=>({
    id:row.id,split,target:row.target,predicted:predictions[i].predicted,
    probabilities:predictions[i].probabilities,
    correct:predictions[i].predicted===row.target,
  }));
  if(matrix.task.type==='regression') {
    if(evidence.some(row=>typeof row.predicted!=='number'||!Number.isFinite(row.predicted)))
      throw new Error('F12_INVALID_REGRESSION_OUTPUT');
    const residuals=evidence.map(row=>row.target-row.predicted);
    const mae=average(residuals.map(Math.abs));
    const mse=average(residuals.map(value=>value*value));
    const mean=average(rows.map(row=>row.target));
    const total=rows.reduce((sum,row)=>sum+(row.target-mean)**2,0);
    return {task:'regression',split,count:rows.length,
      metrics:{mae,mse,rmse:Math.sqrt(mse),
        r2:total>1e-12?1-residuals.reduce((sum,value)=>sum+value*value,0)/total:null},
      evidence:evidence.map((row,i)=>({...row,residual:residuals[i]})),
      explanation:'R² is unavailable for a constant target. All measures are calculated from the complete selected split.'};
  }
  const classes=matrix.task.classes;
  const confusion=classes.map(()=>classes.map(()=>0));
  for(const row of evidence) {
    const actual=classes.indexOf(row.target),predicted=classes.indexOf(row.predicted);
    if(actual<0||predicted<0)throw new Error('F12_INVALID_CLASS_OUTPUT');
    confusion[actual][predicted]++;
  }
  const perClass=classes.map((name,i)=>{
    const tp=confusion[i][i], support=confusion[i].reduce((sum,v)=>sum+v,0);
    const predictedCount=confusion.reduce((sum,row)=>sum+row[i],0);
    const precision=divide(tp,predictedCount), recall=divide(tp,support);
    return {name,support,precision,recall,f1:precision===null||recall===null?null:divide(2*precision*recall,precision+recall)};
  });
  const correct=confusion.reduce((sum,row,i)=>sum+row[i],0);
  const macroF1=average(perClass.map(item=>item.f1).filter(x=>x!==null));
  const weightedF1=perClass.reduce((sum,item)=>sum+(item.f1??0)*item.support,0)/rows.length;
  const accuracy=correct/rows.length;
  const positive=perClass.length===2?perClass[1]:null;
  return {task:matrix.task.type,split,count:rows.length,confusion,perClass,
    metrics:{accuracy,macroF1,weightedF1,
      precision:positive?.precision??null,recall:positive?.recall??null,f1:positive?.f1??null},
    evidence,explanation:'Rows are true classes; columns are predicted classes. Undefined denominators yield unavailable metrics.'};
}
