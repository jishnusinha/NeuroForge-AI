/**
 * F15 bounded N-feature CART for classification or regression.
 * Greedy split selection is deterministic by gain, feature index, threshold.
 * Trees contain only aggregate target statistics; never source row IDs.
 */
import { mulberry32 } from '../datasets.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const gini=counts=>{
  const n=counts.reduce((s,v)=>s+v,0);
  return n?1-counts.reduce((s,v)=>s+(v/n)**2,0):0;
};
const mse=(sum,sumsq,n)=>n?Math.max(0,sumsq/n-(sum/n)**2):0;
const sum=values=>values.reduce((a,b)=>a+b,0);
export function trainCart(rows,features,task,classes,{
  maxDepth=4,minLeaf=3,maxFeaturesPerSplit=null,seed=42,
}={}) {
  if(!Array.isArray(rows)||rows.length<4||rows.length>2000 ||
     !Array.isArray(features)||features.length<1||features.length>20 ||
     !['regression','binary_classification','multiclass_classification'].includes(task) ||
     !Number.isInteger(maxDepth)||maxDepth<1||maxDepth>7 ||
     !Number.isInteger(minLeaf)||minLeaf<2||minLeaf>30 ||
     !Number.isInteger(seed)||seed<0||seed>0xffffffff ||
     (maxFeaturesPerSplit!==null&&(!Number.isInteger(maxFeaturesPerSplit)||
       maxFeaturesPerSplit<1||maxFeaturesPerSplit>features.length)) ||
     rows.some(row=>row.values.length!==features.length||row.values.some(v=>!finite(v))||
       (task==='regression'?!finite(row.target):!classes.includes(row.target))))
    throw new Error('F15_CART_CONFIGURATION');
  const random=mulberry32(seed);
  const classCount=classes.length;
  let nodeCount=0;
  function grow(subset,depth){
    nodeCount++;
    const count=subset.length;
    const tally=task==='regression'?null:
      classes.map(name=>subset.filter(row=>row.target===name).length);
    const ySum=task==='regression'?sum(subset.map(row=>row.target)):null;
    const ySquared=task==='regression'?sum(subset.map(row=>row.target**2)):null;
    const impurity=task==='regression'?mse(ySum,ySquared,count):gini(tally);
    const leaf={
      type:'leaf',samples:count,depth,
      ...(task==='regression'?{value:ySum/count}:{probabilities:tally.map(n=>n/count)}),
    };
    if(depth>=maxDepth||count<minLeaf*2||impurity<=1e-12)return leaf;
    const featureIndices=features.map((_,i)=>i);
    if(maxFeaturesPerSplit!==null&&maxFeaturesPerSplit<featureIndices.length){
      for(let i=featureIndices.length-1;i>0;i--){
        const j=Math.floor(random()*(i+1));
        [featureIndices[i],featureIndices[j]]=[featureIndices[j],featureIndices[i]];
      }
      featureIndices.length=maxFeaturesPerSplit;
      featureIndices.sort((a,b)=>a-b);
    }
    let best=null;
    for(const feature of featureIndices){
      const ordered=subset.slice().sort((a,b)=>a.values[feature]-b.values[feature]);
      const leftCounts=task==='regression'?null:Array(classCount).fill(0);
      const rightCounts=task==='regression'?null:[...tally];
      let leftSum=0,leftSquared=0,rightSum=ySum,rightSquared=ySquared;
      for(let i=0;i<count-1;i++){
        const row=ordered[i];
        if(task==='regression'){
          leftSum+=row.target;leftSquared+=row.target**2;
          rightSum-=row.target;rightSquared-=row.target**2;
        }else{
          const idx=classes.indexOf(row.target);
          leftCounts[idx]++;rightCounts[idx]--;
        }
        const nLeft=i+1,nRight=count-nLeft;
        if(nLeft<minLeaf||nRight<minLeaf||
            ordered[i].values[feature]===ordered[i+1].values[feature])continue;
        const leftImp=task==='regression'?mse(leftSum,leftSquared,nLeft):gini(leftCounts);
        const rightImp=task==='regression'?mse(rightSum,rightSquared,nRight):gini(rightCounts);
        const gain=impurity-(nLeft/count)*leftImp-(nRight/count)*rightImp;
        const threshold=ordered[i].values[feature]/2+ordered[i+1].values[feature]/2;
        if(!finite(gain)||!finite(threshold))continue;
        if(!best||gain>best.gain+1e-12||
          (Math.abs(gain-best.gain)<=1e-12&&
             (feature<best.feature||(feature===best.feature&&threshold<best.threshold))))
          best={feature,threshold,gain};
      }
    }
    // Zero-gain intermediate splits can reveal interactions such as XOR.
    // Only allow them while another level remains to observe a positive gain.
    if(!best||(best.gain<=1e-12&&depth>=maxDepth-1))return leaf;
    const left=subset.filter(row=>row.values[best.feature]<=best.threshold);
    const right=subset.filter(row=>row.values[best.feature]>best.threshold);
    if(left.length<minLeaf||right.length<minLeaf)return leaf;
    return {
      type:'split',samples:count,depth,feature:best.feature,
      threshold:best.threshold,gain:best.gain,
      left:grow(left,depth+1),right:grow(right,depth+1),
    };
  }
  const root=grow(rows,0);
  return {root,nodeCount,maxDepth,minLeaf,seed,maxFeaturesPerSplit};
}
export function traverseCart(root,vector) {
  let node=root;
  while(node?.type==='split')
    node=vector[node.feature]<=node.threshold?node.left:node.right;
  if(node?.type!=='leaf')throw new Error('F15_TREE_ARTIFACT_INVALID');
  return node;
}
export function cartPath(root,vector) {
  const decisions=[];
  let node=root;
  while(node?.type==='split'){
    const lower=vector[node.feature]<=node.threshold;
    decisions.push({featureIndex:node.feature,threshold:node.threshold,direction:lower?'left':'right'});
    node=lower?node.left:node.right;
  }
  if(node?.type!=='leaf')throw new Error('F15_TREE_ARTIFACT_INVALID');
  return {decisions,leaf:node};
}
