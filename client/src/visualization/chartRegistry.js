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
export const MODEL_CHARTS=[
  ['actual_predicted','Actual vs predicted'],['residuals','Residual analysis'],['residual_distribution','Residual distribution'],['error_range','Error by target range'],
  ['confusion','Confusion matrix'],['per_class','Per-class performance'],['roc','ROC curve'],['precision_recall','Precision–recall curve'],['calibration','Probability calibration'],['confidence','Prediction confidence'],['training_loss','Real training loss'],
].map(([id,label])=>({id,label,family:'evaluation'}));
export const EXPLANATION_CHARTS=[['importance','Permutation importance'],['contributions','Local contribution waterfall'],['dependence','PDP + ICE'],['whatif','Hypothetical comparison'],['subgroups','Subgroup performance'],['model_specific','Model-specific explanation']].map(([id,label])=>({id:'model_'+id,label,family:'explanation'}));
export const RESEARCH_CHARTS=[
  ...[['research_leaderboard','Comparable run leaderboard'],['research_matrix','Model performance matrix'],['research_tradeoff','Pairwise metric trade-off'],['research_difference','Run difference'],['research_timeline','Research chronology'],['research_provenance','Experiment provenance matrix']].map(([id,label])=>({id,label,family:'research_registry'})),
  ...[['cv_folds','Fold scores, mean and sample SD'],['cv_heatmap','Trial × fold heatmap'],['cv_response','Tested hyperparameter response'],['cv_leaderboard','Search leaderboard'],['cv_support','Inner-fold support'],['cv_outer','CV vs fixed validation'],['cv_paired','Paired trial differences']].map(([id,label])=>({id,label,family:'research_selection'})),
];
export const CHART_REGISTRY_VERSION=3;
export const CHART_REGISTRY=Object.freeze(definitions.map(([id,label,family])=>Object.freeze({id,label,family})));
export function chartDefinition(type){const def=[...CHART_REGISTRY,...MODEL_CHARTS,...EXPLANATION_CHARTS,...RESEARCH_CHARTS].find(d=>d.id===type);if(!def)throw new Error('F18_UNKNOWN_CHART');return def;}
export async function loadChartAdapter(type){
  const {family}=chartDefinition(type);
  if(family==='research_registry')return import('./adapters/researchRegistryAdapter.js');
  if(family==='research_selection')return import('./adapters/researchSelectionAdapter.js');
  if(family==='evaluation')return import('./adapters/modelEvaluationAdapter.js');
  if(family==='explanation')return import('./adapters/modelExplanationAdapter.js');
  if(family==='distribution')return import('./adapters/distributionAdapter.js');
  if(family==='relationship')return import('./adapters/relationshipAdapter.js');
  if(family==='quality')return import('./adapters/qualityAdapter.js');
  return import('./adapters/pipelineAdapter.js');
}
