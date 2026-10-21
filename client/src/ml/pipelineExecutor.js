import { createStratifiedSplit } from './evaluationProtocol.js';
import { createRegressionSplit } from './modelWorkbench/splits.js';
import { SPLIT_PRESETS } from './pipelinePlanner.js';
import { STUDIO_MAX_FEATURES, STUDIO_MAX_CATEGORIES, validateStudioRecipe } from './pipelineGraph.js';

const missing = value => value === null || value === undefined || value === '' ||
  (typeof value === 'number' && !Number.isFinite(value));
const median = ordered => {
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
};
const quartile = (ordered, q) => {
  const index = (ordered.length - 1) * q;
  const low = Math.floor(index), high = Math.ceil(index);
  return ordered[low] + (ordered[high] - ordered[low]) * (index - low);
};
const finite = value => typeof value === 'number' && Number.isFinite(value);
const asCategory = value => missing(value) ? null : String(value);

function fitNode(trainRows, node, outputColumns, sourceHeaders) {
  const fitted = { id: node.id, type: node.type, columns: [...node.columns], options: { ...node.options }, parameters: {} };
  for (const name of node.columns) {
    if (node.type === 'numeric.impute') {
      const values = trainRows.map(row => row[name]).filter(finite).sort((a,b)=>a-b);
      const strategy = node.options.strategy;
      if (!values.length && strategy !== 'constant') throw new Error('F11_TRAIN_VALUES: No observed training values in ' + name);
      fitted.parameters[name] = {
        fill: strategy === 'constant' ? Number(node.options.value)
          : strategy === 'median' ? median(values)
            : values.reduce((sum,value)=>sum+value,0)/values.length,
        strategy, observedTraining: values.length,
      };
    }
    if (node.type === 'numeric.scale') {
      const values = trainRows.map(row=>row[name]);
      if (!values.length || values.some(value=>!finite(value)))
        throw new Error('F11_NONFINITE_TRAIN: Impute missing training values before scaling ' + name);
      const ordered = values.slice().sort((a,b)=>a-b);
      const mean = values.reduce((sum,value)=>sum+value,0)/values.length;
      const standardDeviation = Math.sqrt(values.reduce((sum,value)=>sum+(value-mean)**2,0) / Math.max(1,values.length-1));
      const q1 = quartile(ordered,.25), q3=quartile(ordered,.75);
      fitted.parameters[name] = {
        strategy: node.options.strategy, mean, standardDeviation,
        min: ordered[0], max: ordered.at(-1),
        median: median(ordered), q1, q3,
        denominatorFallback: '1 if zero variation',
      };
    }
    if (node.type === 'category.impute') {
      const values = trainRows.map(row=>asCategory(row[name])).filter(value=>value!==null);
      const counts = new Map();
      for (const value of values) counts.set(value,(counts.get(value)??0)+1);
      const mode = [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
      if (node.options.strategy === 'mode' && mode===undefined)
        throw new Error('F11_TRAIN_CATEGORIES: No observed training labels in ' + name);
      fitted.parameters[name] = { fill: node.options.strategy==='constant'?node.options.value:mode,
        strategy: node.options.strategy, observedTraining: values.length };
    }
    if (node.type === 'category.onehot') {
      const values = trainRows.map(row=>asCategory(row[name])).filter(value=>value!==null);
      const categories=[...new Set(values)].sort((a,b)=>a.localeCompare(b));
      if (!categories.length) throw new Error('F11_TRAIN_CATEGORIES: No observed training labels in ' + name);
      if (categories.length>STUDIO_MAX_CATEGORIES) throw new Error('F11_CATEGORY_LIMIT: ' + name + ' has more than 8 training categories.');
      const generated=categories.map((_,index)=>name+'__cat_'+(index+1));
      for(const newName of generated) if(outputColumns.includes(newName) || sourceHeaders.includes(newName))
        throw new Error('F11_OUTPUT_COLLISION: '+newName);
      fitted.parameters[name]={categories,generated,unknown:node.options.unknown};
    }
  }
  return fitted;
}

function applyFittedNode(rows, fitted, featureNames) {
  const { type, columns, parameters } = fitted;
  const nextFeatures = [...featureNames];
  if (type === 'category.onehot') {
    for (const name of columns) {
      const index=nextFeatures.indexOf(name);
      const generated=parameters[name].generated;
      nextFeatures.splice(index,1,...generated);
    }
  }
  if (type === 'feature.square')
    for (const name of columns) nextFeatures.push(name+'__squared');
  if (type === 'feature.interaction')
    nextFeatures.push(columns.join('__times__'));
  if (nextFeatures.length>STUDIO_MAX_FEATURES)
    throw new Error('F11_OUTPUT_BUDGET: Prepared outputs exceed 20 numeric features.');

  const transformed = rows.map(row=>{
    const out={...row};
    for (const name of columns) {
      const value=out[name], params=parameters[name];
      if (type === 'numeric.impute') {
        if (!finite(value)) out[name]=params.fill;
      } else if (type === 'category.impute') {
        if (missing(value)) out[name]=params.fill;
      } else if (type === 'numeric.scale') {
        if (!finite(value)) throw new Error('F11_NONFINITE_FEATURE: Add numeric imputation before scaling ' + name);
        let result;
        if(params.strategy==='standardize')
          result=(value-params.mean)/(params.standardDeviation||1);
        else if(params.strategy==='minmax')
          result=(value-params.min)/(params.max-params.min||1);
        else result=(value-params.median)/(params.q3-params.q1||1);
        if(!finite(result)) throw new Error('F11_NUMERIC_OVERFLOW: '+name);
        out[name]=result;
      } else if (type === 'category.onehot') {
        const observed=asCategory(value);
        const index=params.categories.indexOf(observed);
        if(index<0 && params.unknown==='error')
          throw new Error('F11_UNKNOWN_CATEGORY: '+name+' has a held-out or missing category not in the training vocabulary.');
        for(let i=0;i<params.generated.length;i++)out[params.generated[i]]=i===index?1:0;
        delete out[name];
      } else if (type === 'feature.square') {
        if(!finite(value)||!finite(value*value))
          throw new Error('F11_NONFINITE_FEATURE: Square requires finite numeric values in '+name);
        out[name+'__squared']=value*value;
      } else if (type === 'feature.interaction') {
        // A two-column interaction is generated only once, outside this loop.
      }
    }
    if(type==='feature.interaction') {
      const [a,b]=columns;
      const result=out[a]*out[b];
      if(!finite(out[a])||!finite(out[b])||!finite(result))
        throw new Error('F11_NONFINITE_FEATURE: Interaction needs finite inputs.');
      out[a+'__times__'+b]=result;
    }
    return out;
  });
  return { rows: transformed, featureNames: nextFeatures };
}

/**
 * Apply frozen learned parameters to new rows without fitting or reading labels.
 * This path is also used to verify fitted-artifact round trips.
 */
export function transformStudioArtifact(artifact, sourceRows) {
  if(artifact?.schemaVersion!==1 || !Array.isArray(artifact.fittedNodes) ||
      !Array.isArray(artifact.featureColumns) || !Array.isArray(sourceRows))
    throw new Error('F11_INVALID_ARTIFACT');
  let rows=sourceRows.map(row=>({...row}));
  let featureNames=[...artifact.featureColumns];
  for(const fitted of artifact.fittedNodes) {
    const result=applyFittedNode(rows,fitted,featureNames);
    rows=result.rows;featureNames=result.featureNames;
  }
  if(JSON.stringify(featureNames)!==JSON.stringify(artifact.outputFeatures))
    throw new Error('F11_ARTIFACT_SCHEMA_MISMATCH');
  for (const row of rows) for(const name of featureNames)
    if(!finite(row[name])) throw new Error('F11_UNENCODED_OR_MISSING: '+name+' is not a finite numeric model input.');
  return rows;
}

export function executeStudioPipeline(dataset, config, { membershipOverride = null } = {}) {
  const recipe=validateStudioRecipe(dataset,config);
  const raw=dataset.rows.map(row=>({...row}));
  const targets=raw.map(row=>row[recipe.targetColumn]);
  const labels=[...new Set(targets)];
  if(recipe.taskType==='regression') {
    if(targets.some(value=>typeof value!=='number'||!Number.isFinite(value)))
      throw new Error('F12_REGRESSION_REQUIRES_FINITE_TARGET');
  } else if(labels.some(missing)||labels.length<2||labels.length>12) {
    throw new Error('F11_TARGET: Select an observed categorical target with 2–12 classes.');
  }
  // F15 CV supplies exact inner-fold membership *only* for its isolated
  // original-training subset. No default splitter may run on fold data.
  let membership,protocol;
  if(membershipOverride!==null) {
    const partitions=['train','validation','test'];
    if(typeof membershipOverride!=='object'||!partitions.every(name=>Array.isArray(membershipOverride[name])) ||
       membershipOverride.train.length<4||membershipOverride.validation.length<1||
       membershipOverride.test.length!==0)
      throw new Error('F15_INVALID_INNER_FOLD');
    const ids=partitions.flatMap(name=>membershipOverride[name]);
    if(ids.length!==raw.length||new Set(ids).size!==ids.length ||
       ids.some(id=>!raw.some(row=>row.id===id)))
      throw new Error('F15_FOLD_MEMBERSHIP_MISMATCH');
    membership=Object.fromEntries(partitions.map(name=>[name,[...membershipOverride[name]]]));
    protocol={schemaVersion:4,strategy:'f15-inner-fold',seed:recipe.seed,
      counts:{train:membership.train.length,validation:membership.validation.length,
        test:0,total:raw.length},testAccessHistory:[]};
  }else{
    const split=recipe.taskType==='regression'
      ?createRegressionSplit(raw,{...SPLIT_PRESETS[recipe.splitPreset],seed:recipe.seed})
      :createStratifiedSplit(raw,recipe.targetColumn,{...SPLIT_PRESETS[recipe.splitPreset],seed:recipe.seed});
    membership={train:split.train.map(row=>row.id),
      validation:split.validation.map(row=>row.id),test:split.test.map(row=>row.id)};
    protocol=split.protocol;
  }
  const trainIds=new Set(membership.train);
  const partitions=new Map(Object.entries(membership).flatMap(([partition,ids])=>ids.map(id=>[id,partition])));
  let working=raw;
  let featureNames=[...recipe.featureColumns];
  const fittedNodes=[];
  const stageEvidence=[];
  for(const node of recipe.nodes) {
    if(!node.enabled) continue;
    const fitted=fitNode(working.filter(row=>trainIds.has(row.id)),node,featureNames,dataset.headers);
    const result=applyFittedNode(working,fitted,featureNames);
    working=result.rows;featureNames=result.featureNames;
    fittedNodes.push(fitted);
    stageEvidence.push({
      id:node.id,type:node.type,outputFeatures:[...featureNames],
      trainingCount:trainIds.size, parameters: fitted.parameters,
      preview:working.slice(0,4).map(row=>({ id:row.id,values:Object.fromEntries(featureNames.map(name=>[name,row[name]])) })),
    });
  }
  for (const row of working) for (const name of featureNames)
    if(!finite(row[name])) throw new Error('F11_UNENCODED_OR_MISSING: '+name+' is not a finite numeric model input.');
  const sourceTypesValid=recipe.featureColumns.length===2 && recipe.featureColumns.every(name =>
    raw.every(row => missing(row[name]) || finite(row[name])));
  const outputMappingValid=featureNames.length===2 && featureNames.every((name,index)=>name===recipe.featureColumns[index]);
  const labCompatible=recipe.taskType!=='regression' && sourceTypesValid && outputMappingValid && labels.length===2 &&
    labels.every(value=>value===0||value===1);
  const reason=labCompatible?null:recipe.taskType==='regression'
    ? 'Regression is supported in F12 Model Workbench; legacy two-feature labs require binary targets.'
    :featureNames.length!==2
    ? 'Current Playground and Studio accept exactly two numeric output features; this recipe produces '+featureNames.length+'.'
      : !sourceTypesValid || !outputMappingValid
        ? 'Current two-feature labs require two original numeric input columns with unchanged output names; categorical and expanded feature matrices are for F12.'
        : 'Current Playground and Studio require observed binary targets 0 and 1.';
  const artifact={
    kind:'neuroforge-f11-fitted-pipeline',schemaVersion:1,
    featureColumns:[...recipe.featureColumns],targetColumn:recipe.targetColumn,taskType:recipe.taskType,
    outputFeatures:[...featureNames],fittedNodes,splitPreset:recipe.splitPreset,seed:recipe.seed,membership,
  };
  return {
    recipe, artifact, outputFeatures:featureNames, rows:working, raw,
    counts:protocol.counts,membership,protocol,stageEvidence,
    previews:working.slice(0,8).map((row,index)=>({
      id:row.id,partition:partitions.get(row.id),
      original:Object.fromEntries(recipe.featureColumns.map(name=>[name,raw[index][name]])),
      prepared:Object.fromEntries(featureNames.map(name=>[name,row[name]])),
    })),
    labCompatible, reason,
    labPoints:labCompatible?working.map(row=>({
      id:row.id,x:row[featureNames[0]],y:row[featureNames[1]],label:row[recipe.targetColumn],
    })):null,
    labRaw:labCompatible?raw.map(row=>({
      id:row.id,x:row[recipe.featureColumns[0]],y:row[recipe.featureColumns[1]],label:row[recipe.targetColumn],
    })):null,
  };
}
