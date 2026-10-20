/** Review recorded runs without filling missing evidence or comparing incompatible datasets as equal. */
export const NOTEBOOK_METRICS = Object.freeze({
  valAccuracy: { label:'Validation accuracy', direction:'desc' },
  valLoss: { label:'Validation loss', direction:'asc' },
  trainLoss: { label:'Training loss', direction:'asc' },
});

export function notebookRunId(run) {
  return String(run?._id ?? run?.shareId ?? run?.runId ?? '');
}

export function buildRunComparison(runs, metric='valAccuracy') {
  if (!NOTEBOOK_METRICS[metric]) throw new Error('UNSUPPORTED_NOTEBOOK_METRIC');
  const observed=(runs || []).filter(run=>notebookRunId(run)).map(run=>{
    const metrics=run.metrics ?? {};
    const measured=metrics[metric] ?? (metric==='trainLoss'?metrics.loss:null);
    const value=Number.isFinite(measured) ? measured : null;
    return {
      id:notebookRunId(run),name:run.name||'Unnamed run',algorithm:run.algorithm||'Unknown',
      dataset:run.dataset?.name||'Unknown dataset',metric:value,
      metricName:metric,seed:run.evaluation?.splitSeed ?? run.dataset?.seed ?? null,
      record:run,
    };
  });
  observed.sort((a,b)=>{
    if(a.metric===null)return b.metric===null?a.id.localeCompare(b.id):1;
    if(b.metric===null)return -1;
    const sign=NOTEBOOK_METRICS[metric].direction==='desc'?-1:1;
    return sign*(a.metric-b.metric)||a.id.localeCompare(b.id);
  });
  const datasets=new Set(observed.map(item=>item.dataset));
  return {
    metric,label:NOTEBOOK_METRICS[metric].label,
    compared:observed.length,measured:observed.filter(row=>row.metric!==null).length,
    mixedDatasets:datasets.size>1,
    rows:observed.map(item=>({id:item.id,name:item.name,algorithm:item.algorithm,dataset:item.dataset,metric:item.metric,seed:item.seed})),
  };
}
