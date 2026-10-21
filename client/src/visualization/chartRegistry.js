const definitions = [
  ['histogram','Histogram','distribution'],['kde','KDE density','distribution'],['box','Box plot','distribution'],
  ['violin','Violin plot','distribution'],['ecdf','ECDF','distribution'],['count','Categorical counts','distribution'],
  ['scatter','Scatter plot','relationship'],['scatter_matrix','Scatter matrix','relationship'],
  ['hexbin','2D hexbin density','relationship'],['trend','OLS trend','relationship'],
  ['correlation','Correlation heatmap','quality'],['correlation_rank','Correlation ranking','quality'],
  ['missingness','Missingness matrix','quality'],['completeness','Missing-value percentages','quality'],
  ['quality','Column quality','quality'],['types','Value types','quality'],['duplicates','Duplicate rows','quality'],
  ['pipeline_distribution','Before / after distribution','pipeline'],['pipeline_missingness','Missingness before / after','pipeline'],
  ['pipeline_scaling','Scaling comparison','pipeline'],['pipeline_expansion','Feature expansion','pipeline'],
  ['pipeline_lineage','Pipeline lineage','pipeline'],['pipeline_split','Split composition','pipeline'],
  ['pipeline_summary','Fitted transformation summary','pipeline'],['pipeline_invalid','Dropped / unavailable values','pipeline'],
];
export const CHART_REGISTRY_VERSION=1;
export const CHART_REGISTRY=Object.freeze(definitions.map(([id,label,family])=>Object.freeze({id,label,family})));
export function chartDefinition(type){const def=CHART_REGISTRY.find(d=>d.id===type);if(!def)throw new Error('F18_UNKNOWN_CHART');return def;}
export async function loadChartAdapter(type){
  const {family}=chartDefinition(type);
  if(family==='distribution')return import('./adapters/distributionAdapter.js');
  if(family==='relationship')return import('./adapters/relationshipAdapter.js');
  if(family==='quality')return import('./adapters/qualityAdapter.js');
  return import('./adapters/pipelineAdapter.js');
}
