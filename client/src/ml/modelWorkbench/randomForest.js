import { mulberry32 } from '../datasets.js';
import { trainCart, traverseCart } from './cart.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
/**
 * Seeded bagging. Per-node feature subsampling is computed by CART.
 * Training vectors and original IDs are never retained in forest artifacts.
 */
export function trainRandomForest(rows,features,task,classes,{
  trees=12,maxDepth=4,minLeaf=3,seed=42,
}={}) {
  if(!Number.isInteger(trees)||trees<3||trees>30||
     !Number.isInteger(seed)||seed<0||seed>0xffffffff)
    throw new Error('F15_FOREST_CONFIGURATION');
  const random=mulberry32(seed);
  const width=Math.max(1,Math.floor(Math.sqrt(features.length)));
  const forest=[];
  for(let t=0;t<trees;t++){
    const sample=Array.from({length:rows.length},()=>rows[Math.floor(random()*rows.length)]);
    const treeSeed=Math.floor(random()*0x100000000);
    forest.push(trainCart(sample,features,task,classes,{
      maxDepth,minLeaf,maxFeaturesPerSplit:width,seed:treeSeed,
    }));
  }
  return {trees:forest,count:trees,maxDepth,minLeaf,seed,maxFeaturesPerSplit:width};
}
export function forestOutput(parameters,vector,task,classes) {
  const leaves=parameters.trees.map(tree=>traverseCart(tree.root,vector));
  if(task==='regression'){
    const predicted=leaves.reduce((s,leaf)=>s+leaf.value,0)/leaves.length;
    if(!finite(predicted))throw new Error('F15_FOREST_NONFINITE');
    return {predicted,probabilities:null};
  }
  const probabilities=classes.map((_,k)=>
    leaves.reduce((s,leaf)=>s+leaf.probabilities[k],0)/leaves.length);
  const index=probabilities.indexOf(Math.max(...probabilities));
  return {predicted:classes[index],probabilities};
}
