import { validationSample, validateExplanationContext, scoreExplanationRows } from './explainabilityContracts.js';

/**
 * Two equal-meaning numeric groups defined using the TRAIN median, not
 * validation or test quantiles. Reports support and unavailable metrics.
 */
export function subgroupDiagnostics(matrix,model,{
  feature, metric=matrix.task.type==='regression'?'rmse':'accuracy',
  minSupport=5,
}={}) {
  validateExplanationContext(matrix,model);
  const column=matrix.features.indexOf(feature);
  if(column<0||!Number.isInteger(minSupport)||minSupport<2||minSupport>30)
    throw new Error('F13_SUBGROUP_CONFIG');
  const sorted=matrix.rows.filter(row=>row.split==='train')
    .map(row=>row.values[column]).sort((a,b)=>a-b);
  if(!sorted.length)throw new Error('F13_SUBGROUP_TRAINING_REQUIRED');
  const mid=Math.floor(sorted.length/2);
  const boundary=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
  // This analysis uses all actual validation rows (maximum 2000 source rows).
  const rows=validationSample(matrix,model,200,42);
  const groups=[
    {name:feature+' < '+boundary,rows:rows.filter(row=>row.values[column]<boundary)},
    {name:feature+' >= '+boundary,rows:rows.filter(row=>row.values[column]>=boundary)},
  ];
  return {
    status:'ok',scope:'validation',method:'train-median-feature-split',feature,boundary,metric,
    sampleCount:rows.length,sourceCount:matrix.membership.validation.length,
    groups:groups.map(group=>{
      const count=group.rows.length;
      if(count<minSupport)return {name:group.name,count,status:'unavailable',metricValue:null,
        reason:'Below the minimum support of '+minSupport+'.'};
      const result=scoreExplanationRows(matrix,model,group.rows,metric);
      return {name:group.name,count,status:result.value===null?'unavailable':'ok',
        metricValue:result.value,reason:result.value===null?'Metric undefined for this group.':null};
    }),
    limitations:['Subgroups are descriptive; gaps do not establish bias, fairness violations or causal effects.',
      'The split boundary is the training-feature median; sparse groups are unavailable.',
      ...(rows.length<matrix.membership.validation.length?
        ['Deterministic validation subset used for bounded diagnostics.']:[])],
  };
}
