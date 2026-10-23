import { useMemo, useState } from 'react';
import { digest } from '../../../../../shared/domain.mjs';
import { saveSnapshotLocal, getSnapshotLocal } from '../../../services/localRepository.js';
import { classifyPipelineColumns, createStudioNode, defaultStudioRecipe, NODE_DEFINITIONS, STUDIO_MAX_NODES, validateStudioRecipe } from '../../../ml/pipelineGraph.js';
import { executeStudioPipeline, transformStudioArtifact } from '../../../ml/pipelineExecutor.js';
import ModelWorkbench from '../modeling/ModelWorkbench.jsx';
import PipelineVisualization from './PipelineVisualization.jsx';

const inputClass='mt-1 w-full min-h-10 rounded-lg border border-white/20 bg-obsidian px-2 py-2 text-sm text-text-primary';
const STASH_ID='ds-f11-pipeline-recipe';

function downloadRecipe(recipe) {
  const blob=new Blob([JSON.stringify(recipe,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='neuroforge-f11-recipe.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function NodeInspector({ node, available, onChange }) {
  const kind=NODE_DEFINITIONS.find(def=>def.type===node.type)?.input;
  const columns=available.filter(item=>item.kind===kind);
  const updateOptions=patch=>onChange({...node,options:{...node.options,...patch}});
  const toggleColumn=name=>onChange({...node,columns:node.columns.includes(name)
    ?node.columns.filter(value=>value!==name):[...node.columns,name]});
  return <div role="region" aria-label="Selected pipeline step configuration" className="space-y-3 rounded-xl border border-plasma-cyan/25 bg-surface-dark p-3">
    <h5 className="font-semibold">{NODE_DEFINITIONS.find(item=>item.type===node.type)?.label}</h5>
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-text-muted">Input columns</legend>
      {columns.length ? columns.map(item=><label key={item.name} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={node.columns.includes(item.name)}
          onChange={()=>toggleColumn(item.name)}/>
        {item.name}
      </label>) : <p className="text-xs text-signal-amber">No compatible source features. Select a feature of the required type first.</p>}
    </fieldset>
    {node.type==='numeric.impute' && <label className="block text-xs font-medium">Numeric imputation strategy
      <select aria-label="Numeric imputation strategy" value={node.options.strategy} onChange={event=>updateOptions({strategy:event.target.value})} className={inputClass}>
        <option value="mean">Training mean</option><option value="median">Training median</option><option value="constant">Constant value</option>
      </select>
    </label>}
    {node.type==='numeric.scale' && <label className="block text-xs font-medium">Scaling strategy
      <select aria-label="Scaling strategy" value={node.options.strategy} onChange={event=>updateOptions({strategy:event.target.value})} className={inputClass}>
        <option value="standardize">Standardize (training mean / SD)</option>
        <option value="minmax">Min-max (training range)</option>
        <option value="robust">Robust (training median / IQR)</option>
      </select>
    </label>}
    {node.type==='category.impute' && <label className="block text-xs font-medium">Category imputation strategy
      <select aria-label="Category imputation strategy" value={node.options.strategy} onChange={event=>updateOptions({strategy:event.target.value})} className={inputClass}>
        <option value="mode">Most common training label</option>
        <option value="constant">Constant category</option>
      </select>
    </label>}
    {(node.type==='numeric.impute'||node.type==='category.impute')&&node.options.strategy==='constant'&&
      <label className="block text-xs font-medium">Constant replacement
        <input aria-label="Imputation constant" value={node.options.value??''}
          onChange={event=>updateOptions({value:event.target.value})} className={inputClass}/>
      </label>}
    {node.type==='category.onehot' && <label className="block text-xs font-medium">Unseen category policy
      <select aria-label="Unknown-category policy" value={node.options.unknown} onChange={event=>updateOptions({unknown:event.target.value})} className={inputClass}>
        <option value="allZero">Encode unseen/missing as all zero</option>
        <option value="error">Reject unseen/missing categories</option>
      </select>
    </label>}
    {node.type==='feature.square' && <p className="text-xs text-text-muted">Creates one squared feature per selected numeric input. No fitting parameters are learned.</p>}
    {node.type==='feature.interaction' && <p className="text-xs text-text-muted">Select exactly two numeric inputs to create their multiplication. No label information is used.</p>}
    <p className="text-xs text-text-muted">Node settings are applied to actual data. Only training records contribute learned parameters.</p>
  </div>;
}

function StepList({ recipe, selectedId, onSelect, onChange }) {
  const nodes=recipe.nodes;
  const update=index=>node=>onChange({...recipe,nodes:nodes.map((item,i)=>i===index?node:item)});
  const move=(index,shift)=>onChange({...recipe,nodes:nodes.map((item,i)=>{
    const other=index+shift;
    if(i===index)return nodes[other];
    if(i===other)return nodes[index];
    return item;
  })});
  return <ol aria-label=" executable pipeline steps" className="space-y-2">
    {nodes.map((node,index)=><li key={node.id} className={'rounded-xl border p-3 space-y-2 '+(node.id===selectedId?'border-plasma-cyan/40 bg-plasma-cyan/5':'border-white/10 bg-obsidian')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-label={'Configure pipeline step '+(index+1)}
          onClick={()=>onSelect(node.id)} className="text-left text-sm font-semibold text-text-primary">
          <span className="mr-2 font-mono text-xs text-text-muted">{index+1}.</span>
          {NODE_DEFINITIONS.find(def=>def.type===node.type)?.label}
        </button>
        <span className="text-xs text-text-muted">{node.enabled?'Active':'Disabled'}</span>
      </div>
      <p className="break-all text-xs text-text-muted">{node.columns.join(', ')||'No columns chosen'}</p>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <button type="button" aria-label={'Move step '+(index+1)+' up'} disabled={!index} onClick={()=>move(index,-1)}
          className="rounded border border-white/15 px-2 py-1.5 disabled:opacity-40">Up</button>
        <button type="button" aria-label={'Move step '+(index+1)+' down'} disabled={index===nodes.length-1} onClick={()=>move(index,1)}
          className="rounded border border-white/15 px-2 py-1.5 disabled:opacity-40">Down</button>
        <button type="button" aria-label={'Duplicate step '+(index+1)} disabled={nodes.length>=STUDIO_MAX_NODES}
          onClick={()=>onChange({...recipe,nodes:[...nodes.slice(0,index+1),{...node,id:'copy-'+Date.now()+'-'+index,options:{...node.options},columns:[...node.columns]},...nodes.slice(index+1)]})}
          className="rounded border border-white/15 px-2 py-1.5 disabled:opacity-40">Duplicate</button>
        <label className="flex items-center gap-1.5 rounded border border-white/15 px-2 py-1">
          <input type="checkbox" aria-label={'Enable step '+(index+1)} checked={node.enabled} onChange={event=>update(index)({...node,enabled:event.target.checked})}/> Enabled
        </label>
        <button type="button" aria-label={'Remove step '+(index+1)} onClick={()=>onChange({...recipe,nodes:nodes.filter((_,i)=>i!==index)})}
          className="rounded border border-white/15 px-2 py-1.5">Remove</button>
      </div>
    </li>)}
  </ol>;
}

export default function PipelineStudio({ dataset, onLaunch }) {
  const [recipe, setRecipe]=useState(()=>defaultStudioRecipe(dataset));
  const [selectedId, setSelectedId]=useState('numeric-imputation');
  const [newType, setNewType]=useState('numeric.impute');
  const [message, setMessage]=useState('');
  const [error, setError]=useState('');
  const kinds=useMemo(()=>classifyPipelineColumns(dataset),[dataset]);
  const available=(dataset?.headers??[]).filter(name=>name!==recipe.targetColumn&&recipe.featureColumns.includes(name))
    .map(name=>({name,kind:kinds[name]}));
  const result=useMemo(()=>{
    if(!dataset)return{plan:null,error:'Import a dataset to build a pipeline.'};
    try{return{plan:executeStudioPipeline(dataset,recipe),error:null};}
    catch(reason){return{plan:null,error:reason.message};}
  },[dataset,recipe]);
  const selected=recipe.nodes.find(node=>node.id===selectedId)??recipe.nodes[0];
  const editSelected=node=>setRecipe(previous=>({...previous,nodes:previous.nodes.map(item=>item.id===selected.id?node:item)}));
  const withFeedback=fn=>async()=>{
    setError('');setMessage('');
    try{await fn();}
    catch(reason){setError(reason.message||'Operation failed.');}
  };
  const fingerprint=()=>digest({headers:dataset.headers,rows:dataset.rows.map(row=>({
    id:row.id,values:dataset.headers.map(column=>row[column]??null),
  }))});
  const save=withFeedback(async()=>{
    validateStudioRecipe(dataset,recipe);
    await saveSnapshotLocal({
      id:STASH_ID,kind:'f11-recipe',schemaVersion:1,sourceDigest:await fingerprint(),recipe,
    });
    setMessage('Pipeline recipe saved locally for this browser account.');
  });
  const restore=withFeedback(async()=>{
    const item=await getSnapshotLocal(STASH_ID);
    if(!item||item.kind!=='f11-recipe')throw new Error('No locally saved  recipe found.');
    if(item.sourceDigest!==await fingerprint())
      throw new Error('Saved recipe belongs to a different dataset; no changes were applied.');
    const valid=validateStudioRecipe(dataset,item.recipe);
    setRecipe(valid);
    setSelectedId(previous => valid.nodes.some(node => node.id === previous) ? previous : (valid.nodes[0]?.id ?? ''));
    setMessage('Pipeline recipe restored for the matching dataset.');
  });
  const importFile=async(event)=>{
    const file=event.target.files?.[0];
    if(!file)return;
    setError('');setMessage('');
    try{
      if(file.size>25000)throw new Error('Pipeline recipes must be at most 25 KB.');
      const parsed=JSON.parse(await file.text());
      const valid=validateStudioRecipe(dataset,parsed);
      setRecipe(valid);setSelectedId(valid.nodes[0]?.id??'');
      setMessage('Recipe imported. Validate the preview before launching.');
    }catch(reason){setError('Recipe import failed: '+reason.message);}
    finally{event.target.value='';}
  };
  const addNode=()=>{
    if(recipe.nodes.length>=STUDIO_MAX_NODES)return;
    const node=createStudioNode(newType,recipe,dataset);
    if(!node.columns.length){setError('Choose a compatible input feature before adding this step.');return;}
    setRecipe(previous=>({...previous,nodes:[...previous.nodes,node]}));
    setSelectedId(node.id);setError('');
  };
  const launch=(workspace)=>async()=>{
    setError('');setMessage('');
    try {
      if(!result.plan?.labCompatible)throw new Error(result.error||result.plan?.reason||'Pipeline is not compatible with the selected lab.');
      const replay=transformStudioArtifact(result.plan.artifact,result.plan.raw);
      if(JSON.stringify(replay)!==JSON.stringify(result.plan.rows))
        throw new Error('F11_ARTIFACT_REPLAY: Replayed pipeline differs from its preview.');
      await onLaunch(result.plan,workspace);
    }catch(reason){setError(reason.message);}
  };
  return <details id="prism-preprocessing" className="rounded-xl border border-plasma-cyan/25 bg-surface-dark p-3 sm:p-4">
    <summary className="cursor-pointer text-lg font-semibold text-text-primary">Advanced Pipeline Studio (F11) <span className="block text-xs font-normal text-text-muted">Build real, ordered, reproducible transformations; open the editor</span></summary>
    <div role="region" aria-label=" Pipeline Studio" className="mt-4 space-y-4">
      <p className="text-sm text-text-muted">Raw imported rows remain unchanged. Split membership is established before fitting.  accepts all prepared features for classification or regression; legacy Playground and Studio still require two numeric inputs with 0/1 labels.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="rounded-xl border border-white/10 bg-obsidian p-3">
          <legend className="px-1 text-sm font-semibold">Input features</legend>
          <div className="max-h-44 overflow-auto space-y-2">
            {dataset.headers.filter(name=>name!==recipe.targetColumn).map(name=><label key={name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={recipe.featureColumns.includes(name)}
                onChange={event=>setRecipe(previous=>({...previous,featureColumns:event.target.checked?
                  [...previous.featureColumns,name]:previous.featureColumns.filter(col=>col!==name)}))}/>
              {name} <span className="text-xs text-text-muted">({kinds[name]})</span>
            </label>)}
          </div>
        </fieldset>
        <div className="space-y-2 rounded-xl border border-white/10 bg-obsidian p-3">
          <label className="block text-xs font-semibold">Learning task
            <select aria-label=" learning task" value={recipe.taskType??'classification'} onChange={event=>setRecipe(previous=>({...previous,taskType:event.target.value}))} className={inputClass}>
              <option value="classification">Classification (2–12 classes)</option>
              <option value="regression">Regression (continuous numeric target)</option>
            </select>
          </label>
          <label className="block text-xs font-semibold">Target column
            <select aria-label=" target column" value={recipe.targetColumn} onChange={event=>setRecipe(previous=>({
              ...previous,targetColumn:event.target.value,
              featureColumns:previous.featureColumns.filter(name=>name!==event.target.value),
            }))} className={inputClass}>
              {dataset.headers.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold">Split configuration
            <select aria-label=" split preset" value={recipe.splitPreset} onChange={event=>setRecipe(previous=>({...previous,splitPreset:event.target.value}))} className={inputClass}>
              <option value="70/15/15">70 / 15 / 15</option><option value="80/10/10">80 / 10 / 10</option><option value="60/20/20">60 / 20 / 20</option>
            </select>
          </label>
          <label className="block text-xs font-semibold">Split seed
            <input type="number" aria-label=" split seed" min="0" max="4294967295" step="1" value={recipe.seed}
              onChange={event=>setRecipe(previous=>({...previous,seed:Number(event.target.value)}))}
              className={inputClass}/>
          </label>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div className="space-y-2">
          <h5 className="font-semibold">Executable steps <span className="text-xs font-normal text-text-muted">({recipe.nodes.length}/{STUDIO_MAX_NODES})</span></h5>
          <StepList recipe={recipe} selectedId={selected?.id} onSelect={setSelectedId} onChange={setRecipe}/>
          <div className="flex flex-wrap gap-2">
            <select aria-label="New pipeline step type" value={newType} onChange={event=>setNewType(event.target.value)} className={inputClass+' flex-1'}>
              {NODE_DEFINITIONS.map(def=><option key={def.type} value={def.type}>{def.label}</option>)}
            </select>
            <button type="button" disabled={recipe.nodes.length>=STUDIO_MAX_NODES} onClick={addNode}
              className="min-h-10 rounded-lg bg-plasma-cyan px-4 text-sm font-semibold text-ink-on-accent disabled:opacity-40">Add step</button>
          </div>
        </div>
        {selected&&<NodeInspector key={selected.id} node={selected} available={available} onChange={editSelected}/>}
      </div>
      {result.error?<p role="status" className="rounded-lg border border-signal-amber/30 bg-signal-amber/10 p-3 text-sm text-signal-amber">Pipeline preview unavailable: {result.error}</p>
        :<div role="region" aria-label=" fitted pipeline preview" className="rounded-xl border border-quantum-mint/25 bg-obsidian p-3 space-y-3">
          <h5 className="font-semibold text-quantum-mint">Pipeline ready · Training-only fitted parameters</h5>
          <p className="text-xs text-text-muted">{result.plan.counts.train} training · {result.plan.counts.validation} validation · {result.plan.counts.test} test · {result.plan.outputFeatures.length} numeric output features</p>
          <p className="break-all text-xs text-text-muted">Output schema: {result.plan.outputFeatures.join(', ')}</p>
          <div className="max-w-full overflow-auto">
            <table className="min-w-[560px] w-full text-left text-xs">
              <caption className="p-2 text-left text-text-muted">First {result.plan.previews.length} original and prepared observations, in original row order.</caption>
              <thead className="bg-surface-elevated"><tr><th scope="col" className="p-2">ID / split</th><th scope="col" className="p-2">Original inputs</th><th scope="col" className="p-2">Prepared numeric outputs</th></tr></thead>
              <tbody>{result.plan.previews.map(row=><tr key={row.id} className="border-t border-white/10">
                <td className="p-2">{row.id} <span className="block text-text-muted">{row.partition}</span></td>
                <td className="p-2 font-mono break-all">{JSON.stringify(row.original)}</td>
                <td className="p-2 font-mono break-all">{JSON.stringify(row.prepared)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {result.plan.stageEvidence.map(stage=><details key={stage.id} className="rounded-lg border border-white/10 p-2">
            <summary className="cursor-pointer text-xs font-semibold">{stage.type} · {stage.trainingCount} fitting rows · {stage.outputFeatures.length} outputs</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs text-text-muted">{JSON.stringify(stage.parameters,null,2)}</pre>
          </details>)}
          {result.plan.reason&&<p role="status" className="text-sm text-signal-amber">{result.plan.reason}</p>}
        </div>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="min-h-10 rounded-lg border border-white/20 px-3 text-sm">Save local recipe</button>
        <button type="button" onClick={restore} className="min-h-10 rounded-lg border border-white/20 px-3 text-sm">Restore local recipe</button>
        <button type="button" onClick={()=>downloadRecipe(recipe)} className="min-h-10 rounded-lg border border-white/20 px-3 text-sm">Export recipe JSON</button>
        <label className="min-h-10 cursor-pointer rounded-lg border border-white/20 px-3 py-2 text-sm">Import recipe JSON
          <input aria-label="Import  recipe" type="file" accept=".json,application/json" className="sr-only" onChange={importFile}/>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!result.plan?.labCompatible} onClick={launch('playground')}
          className="min-h-11 rounded-lg bg-plasma-cyan px-4 text-sm font-semibold text-ink-on-accent disabled:opacity-40">Launch  pipeline in Playground</button>
        <button type="button" disabled={!result.plan?.labCompatible} onClick={launch('studio')}
          className="min-h-11 rounded-lg border border-plasma-cyan/40 bg-plasma-cyan/10 px-4 text-sm font-semibold text-plasma-cyan disabled:opacity-40">Launch  pipeline in Studio</button>
      </div>
      {result.plan&&<PipelineVisualization dataset={dataset} plan={result.plan}/>}
      {result.plan && <ModelWorkbench key={JSON.stringify(recipe)} plan={result.plan}/>}
      {message&&<p role="status" className="text-sm text-quantum-mint">{message}</p>}
      {error&&<p role="alert" className="text-sm text-signal-amber">{error}</p>}
      <p className="text-xs text-text-muted">This editor uses a bounded ordered pipeline, not an arbitrary graph executor. Recipes contain no raw rows. Fitted parameters and split identities accompany a launched run.</p>
    </div>
  </details>;
}
