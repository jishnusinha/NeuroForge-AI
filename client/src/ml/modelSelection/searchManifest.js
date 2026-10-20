export const MAX_F15_CONFIGS=12;
export const MAX_F15_FITS=60;
export const F15_GRID=Object.freeze({
  baseline:[{}],
  logistic:[{lambda:0.01,epochs:180},{lambda:0.1,epochs:180}],
  ridge:[{lambda:0.001},{lambda:0.1}],
  knn:[{k:3},{k:7}],
  softmax:[{lambda:0.01,epochs:140},{lambda:0.1,epochs:220}],
  cart:[{maxDepth:3,minLeaf:3},{maxDepth:5,minLeaf:3},
    {maxDepth:5,minLeaf:5}],
  forest:[{trees:8,maxDepth:3,minLeaf:3,seed:42},
    {trees:12,maxDepth:5,minLeaf:3,seed:42},
    {trees:16,maxDepth:5,minLeaf:5,seed:42}],
});
export function validateSearchRequest(task,algorithm,{folds=3,seed=42,metric=null,configs=null}={}) {
  const taskAlgorithms=task==='regression'
    ?['baseline','ridge','cart','forest']
    :task==='binary_classification'
      ?['baseline','logistic','knn','softmax','cart','forest']
      :['baseline','knn','softmax','cart','forest'];
  if(!taskAlgorithms.includes(algorithm)||![3,5].includes(folds)||
     !Number.isInteger(seed)||seed<0||seed>0xffffffff)
    throw new Error('F15_INVALID_SEARCH_REQUEST');
  const options=configs??F15_GRID[algorithm];
  if(!Array.isArray(options)||options.length<1||options.length>MAX_F15_CONFIGS||
     options.some(entry=>!entry||typeof entry!=='object'||Array.isArray(entry))||
     options.length*folds>MAX_F15_FITS)
    throw new Error('F15_SEARCH_BUDGET');
  const supported=task==='regression'?['rmse','mae','r2']:['accuracy','macroF1'];
  const selected=metric??(task==='regression'?'rmse':'accuracy');
  if(!supported.includes(selected))throw new Error('F15_INVALID_SEARCH_METRIC');
  return {algorithm,task,folds,seed,metric:selected,
    direction:task==='regression'&&selected!=='r2'?'minimize':'maximize',
    configs:options.map(item=>({...item}))};
}
