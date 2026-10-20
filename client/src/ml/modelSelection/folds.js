import { mulberry32 } from '../datasets.js';
const labelKey=value=>typeof value+':'+String(value);
/**
 * Exact membership of original F11 TRAIN observations.
 * Neither original validation nor original test may enter a fold.
 */
export function createInnerFolds(rawRows,trainingMembership,targetColumn,taskType,{
  folds=3,seed=42,
}={}) {
  if(![3,5].includes(folds)||!Number.isInteger(seed)||seed<0||seed>0xffffffff||
     !Array.isArray(rawRows)||!Array.isArray(trainingMembership)||
     trainingMembership.length<folds*2||trainingMembership.length>2000 ||
     new Set(trainingMembership).size!==trainingMembership.length)
    throw new Error('F15_FOLD_CONFIGURATION');
  const rows=new Map(rawRows.map(row=>[row.id,row]));
  if(rows.size!==rawRows.length||trainingMembership.some(id=>!rows.has(id)))
    throw new Error('F15_FOLD_SOURCE_MISMATCH');
  const random=mulberry32(seed);
  const bins=Array.from({length:folds},()=>[]);
  const shuffle=ids=>{
    const values=[...ids].sort();
    for(let i=values.length-1;i>0;i--){
      const j=Math.floor(random()*(i+1));
      [values[i],values[j]]=[values[j],values[i]];
    }
    return values;
  };
  if(taskType==='regression'){
    shuffle(trainingMembership).forEach((id,index)=>bins[index%folds].push(id));
  }else{
    const strata=new Map();
    for(const id of trainingMembership){
      const value=rows.get(id)[targetColumn];
      if(value===null||value===undefined||value==='')throw new Error('F15_FOLD_MISSING_TARGET');
      const key=labelKey(value);
      if(!strata.has(key))strata.set(key,[]);
      strata.get(key).push(id);
    }
    if(strata.size<2||strata.size>12||[...strata.values()].some(ids=>ids.length<folds))
      throw new Error('F15_INSUFFICIENT_CLASS_SUPPORT_FOR_FOLDS');
    let offset=0;
    for(const key of [...strata.keys()].sort()){
      const ids=shuffle(strata.get(key));
      ids.forEach((id,index)=>bins[(offset+index)%folds].push(id));
      offset=(offset+ids.length)%folds;
    }
  }
  const all=new Set(trainingMembership);
  const result=bins.map((valid,index)=>{
    const validation=[...valid].sort();
    const validationIds=new Set(validation);
    const train=[...trainingMembership].filter(id=>!validationIds.has(id)).sort();
    if(!train.length||!validation.length||train.length+validation.length!==all.size)
      throw new Error('F15_FOLD_PARTITION_INVALID');
    return {index,train,validation,test:[]};
  });
  if(result.flatMap(fold=>fold.validation).length!==trainingMembership.length||
     new Set(result.flatMap(fold=>fold.validation)).size!==trainingMembership.length)
    throw new Error('F15_FOLD_NOT_EXHAUSTIVE');
  return result;
}
