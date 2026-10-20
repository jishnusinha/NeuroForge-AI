import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAndValidateCSV } from '../../ml/datasetImport.js';
import { PreprocessingPipeline } from '../../ml/preprocessingPipeline.js';
import { createStratifiedSplit } from '../../ml/evaluationProtocol.js';
import { validateExecutionBudget } from '../../services/productionConfig.js';
import { digest } from '../../../../shared/domain.mjs';
import { useLabStore } from '../../store/useLabStore.js';

export default function DatasetPreparation() {
  const [data,setData]=useState(null), [columns,setColumns]=useState({x:'',y:'',target:''}), [scaling,setScaling]=useState('standardize'), [seed,setSeed]=useState(42), [error,setError]=useState('');
  const navigate=useNavigate(); const loadRun=useLabStore(state=>state.loadRun);
  const launch=async workspace=>{
    try {
      if (new Set(Object.values(columns)).size!==3) throw new Error('Choose two distinct inputs and a separate target.');
      validateExecutionBudget(data.rows.length,2);
      const raw=data.rows.map(row=>({id:row.id,x:row[columns.x],y:row[columns.y],label:row[columns.target]}));
      if(raw.some(row=>![0,1].includes(row.label)))throw new Error('The visual classifier requires target values 0 and 1.');
      const split=createStratifiedSplit(raw,'label',{seed});
      if(new Set(split.train.map(row=>row.label)).size!==2 || !split.validation.length || !split.test.length)throw new Error('Insufficient samples for a train/validation/test split with both training classes.');
      const pipeline=new PreprocessingPipeline([{type:'impute'},...(scaling==='none'?[]:[{type:scaling}])]).fit(split.train,['x','y']);
      const points=pipeline.transform(raw); const serialized=pipeline.toJSON();
      const preparation={pipeline:serialized,originalPoints:raw,seed,membership:{train:split.train.map(p=>p.id),validation:split.validation.map(p=>p.id),test:split.test.map(p=>p.id)},testAccessHistory:[]};
      loadRun({workspace,algorithm:'Logistic Regression',dataset:{name:'Imported CSV',points,preparation,preprocessing:'pipeline:'+await digest(serialized),trainRatio:.7,seed:null},hyperparameters:{}});
      navigate('/app/'+workspace);
    }catch(reason){setError(reason.message);}
  };
  return <section aria-label="CSV preparation" className="p-4 border border-white/10 rounded space-y-3"><h3 className="font-bold">Import and prepare CSV</h3><p>Two numeric inputs and a binary target. Imputation and scaling fit training rows only. A separate test set stays held out.</p>
    <input aria-label="CSV file" type="file" accept=".csv,text/csv" onChange={async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>2*1024*1024)throw new Error('CSV must be at most 2 MB.');const parsed=parseAndValidateCSV(await file.text());setData(parsed);setColumns({x:parsed.headers[0],y:parsed.headers[1],target:parsed.headers[2]||''});setError('');}catch(reason){setError(reason.message);}}}/>
    {data&&<><p>{data.rowCount} rows · {data.headers.length} columns</p>{['x','y','target'].map(key=><label className="p-2" key={key}>{key}<select aria-label={'CSV '+key} value={columns[key]} onChange={event=>setColumns({...columns,[key]:event.target.value})}>{data.headers.map(header=><option key={header}>{header}</option>)}</select></label>)}
      <label>Scaling<select aria-label="CSV scaling" value={scaling} onChange={event=>setScaling(event.target.value)}><option value="standardize">Standardize</option><option value="minmax">Min-max</option><option value="none">None</option></select></label><label>Split seed<input aria-label="CSV split seed" type="number" value={seed} onChange={event=>setSeed(Number(event.target.value))}/></label>
      <div className="overflow-x-auto"><table><thead><tr>{data.headers.map(h=><th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{data.rows.slice(0,5).map(row=><tr key={row.id}>{data.headers.map(h=><td className="p-2" key={h}>{String(row[h]??'Missing')}</td>)}</tr>)}</tbody></table></div>
      <button className="p-3 bg-cyan-800 rounded" onClick={()=>launch('playground')}>Prepare for Playground</button><button className="p-3" onClick={()=>launch('studio')}>Prepare for Studio</button></>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
