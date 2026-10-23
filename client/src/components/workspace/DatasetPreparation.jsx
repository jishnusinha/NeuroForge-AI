import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importCsvFile } from '../../ml/importCsvFile.js';
import { buildDatasetPipeline, defaultPipelineColumns, SPLIT_PRESETS } from '../../ml/pipelinePlanner.js';
import { validateExecutionBudget } from '../../services/productionConfig.js';
import { digest } from '../../../../shared/domain.mjs';
import { useLabStore } from '../../store/useLabStore.js';
import PipelineStudio from './pipeline/PipelineStudio.jsx';
import {useSourceEdits} from '../../services/useSourceEdits.js';
const FullSourceModeling=lazy(()=>import('./modeling/FullSourceModeling.jsx'));

const display = value => Number.isFinite(value) ? Number(value.toFixed(4)).toLocaleString() : 'Missing';

export default function DatasetPreparation({ initialData = null, onParsed, onSampleSelected }) {
  const [data, setData] = useState(initialData);
  const [columns, setColumns] = useState(() => defaultPipelineColumns(initialData));
  const [imputation, setImputation] = useState('mean');
  const [scaling, setScaling] = useState('standardize');
  const [splitPreset, setSplitPreset] = useState('70/15/15');
  const [seed, setSeed] = useState(42);
  const [error, setError] = useState('');
  const [importProgress,setImportProgress]=useState(null);
  const [sourceSummary,setSourceSummary]=useState(initialData?.sourceSummary||null);
  const [modelSelected,setModelSelected]=useState(!initialData?.sourceSummary);
  const [fullSourceOpened,setFullSourceOpened]=useState(false);
  const {edits:sourceEdits,error:sourceEditError,revision:sourceEditRevision}=useSourceEdits(sourceSummary);
  const [sampleEditRevision,setSampleEditRevision]=useState(null);
  const sampleEditsChanged=Boolean(sourceSummary&&modelSelected&&sampleEditRevision!==sourceEditRevision);
  const [delimiter,setDelimiter]=useState('auto');
  const [quoteChar,setQuoteChar]=useState('"');
  const [encoding,setEncoding]=useState('utf-8');
  const [hasHeader,setHasHeader]=useState(true);
  const [decimalSeparator,setDecimalSeparator]=useState('.');
  const [schemaOverrides,setSchemaOverrides]=useState(initialData?.sourceOptions?.schemaOverrides||{});
  const [modelSampleSize,setModelSampleSize]=useState(1600);
  const [importDiagnostics,setImportDiagnostics]=useState([]);
  const importAbort=useRef(null);
  const reparseContext=useRef({data,sourceSummary,onParsed});
  useEffect(()=>{reparseContext.current={data,sourceSummary,onParsed};},[data,sourceSummary,onParsed]);
  useEffect(()=>()=>importAbort.current?.abort(),[]);
  useEffect(()=>{
    const current=reparseContext.current,{data:currentData,sourceSummary:currentSummary,onParsed:notifyParsed}=current;
    if(!currentData?.sourceFile||!currentSummary)return;
    const previous=currentData.sourceOptions?.schemaOverrides||{};
    if(JSON.stringify(previous)===JSON.stringify(schemaOverrides))return;
    const controller=new AbortController();importAbort.current?.abort();importAbort.current=controller;
    setModelSelected(false);setImportDiagnostics([]);setError('');setImportProgress({fileName:currentData.sourceFile.name,bytes:0,totalBytes:currentData.sourceFile.size,rows:0});
    importCsvFile(currentData.sourceFile,{...currentData.sourceOptions,schemaOverrides,signal:controller.signal,onProgress:setImportProgress})
      .then(summary=>{const parsed={...currentData,rows:summary.previewRows,rowCount:summary.previewRows.length,sourceSummary:summary,sourceRowCount:summary.sourceRows,sourceOptions:{...currentData.sourceOptions,schemaOverrides},modelSelection:null};setSourceSummary(summary);setData(parsed);setColumns(defaultPipelineColumns(parsed));notifyParsed?.(parsed,currentData.sourceFile.name);setImportProgress(null);})
      .catch(reason=>{if(reason.name!=='AbortError'){setError(reason.message);setImportDiagnostics(reason.diagnostics||[]);}setImportProgress(null);});
    return()=>controller.abort();
  },[schemaOverrides]);
  const navigate = useNavigate();
  const loadRun = useLabStore(state => state.loadRun);

  const result = useMemo(() => {
    if (!data) return { plan: null, issue: null };
    try {
      const plan = buildDatasetPipeline(data, { columns, imputation, scaling, splitPreset, seed });
      return { plan, issue: null };
    } catch (reason) {
      return { plan: null, issue: reason.message };
    }
  }, [data, columns, imputation, scaling, splitPreset, seed]);

  const launch = async workspace => {
    try {
      if (!data) throw new Error('Import or select a dataset before preparation.');
      if(sourceEditError||sampleEditsChanged)throw new Error(sourceEditError||'Source edits changed. Select the reproducible model sample again before preparation.');
      if (result.issue) throw new Error(result.issue);
      if (!result.plan) throw new Error('Preview the preparation pipeline before launching a lab.');
      validateExecutionBudget(data.rows.length, 2);
      const plan = result.plan;
      const serialized = plan.pipeline.toJSON();
      const preparation = {
        pipeline: serialized,
        originalPoints: plan.raw,
        seed: plan.seed,
        membership: plan.membership,
        testAccessHistory: [],
        plan: { columns: plan.columns, imputation: plan.imputation,
          scaling: plan.scaling, splitPreset: plan.splitPreset },
      };
      loadRun({
        workspace, algorithm: 'Logistic Regression',
        dataset: {
          name: 'Imported CSV', points: plan.points, preparation,
          ...(data.provenance?{provenance:structuredClone(data.provenance)}:{}),
          preprocessing: 'pipeline:' + await digest(serialized) + (data.provenance ? ':dataset:' + data.provenance.fingerprint : ''),
          trainRatio: plan.protocol.ratios.trainRatio, seed: null,
        },
        hyperparameters: {},
      });
      setError('');
      navigate('/app/' + workspace);
    } catch (reason) {
      setError(reason.message);
    }
  };


  const launchAdvanced = async (plan, workspace) => {
    if(sourceEditError||sampleEditsChanged)throw new Error(sourceEditError||'Source edits changed. Select the reproducible model sample again before preparation.');
    if (!data || !plan.labCompatible || !plan.labPoints) throw new Error('F11_LAB_COMPATIBILITY: Choose exactly two numeric output features and binary targets 0/1.');
    validateExecutionBudget(plan.labPoints.length, plan.outputFeatures.length);
    const serialized = plan.artifact;
    const preparation = {
      pipeline: serialized,
      originalPoints: plan.labRaw,
      seed: plan.recipe.seed,
      membership: plan.membership,
      testAccessHistory: [],
      plan: {
        kind: 'f11-pipeline-studio', recipe: plan.recipe,
        outputFeatures: plan.outputFeatures, splitPreset: plan.recipe.splitPreset,
      },
    };
    loadRun({
      workspace, algorithm: 'Logistic Regression',
      dataset: {
        name: 'Imported CSV ( prepared)',
        ...(data.provenance?{provenance:structuredClone(data.provenance)}:{}),
        points: plan.labPoints,
        preparation,
        preprocessing: 'pipeline:' + await digest(serialized) + (data.provenance ? ':dataset:' + data.provenance.fingerprint : ''),
        trainRatio: plan.protocol.ratios.trainRatio,
        seed: null,
      },
      hyperparameters: {},
    });
    setError('');
    navigate('/app/' + workspace);
  };

  return <section aria-label="CSV preparation" className="space-y-4 rounded-xl border border-white/10 bg-obsidian/50 p-3 sm:p-4">
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-white">Visual preparation pipeline</h3>
      <p className="text-xs leading-relaxed text-text-muted">
        CSV and TSV files are scanned locally in a background worker (up to 100 MiB and 100 columns on this device).
        Choose full-source fitting for supported numeric models, or an explicit sample for the visual model labs.
        Visual model labs remain limited to 2,000 rows and 20 features.
      </p>
    </div>
    <label className="block max-w-xl text-sm font-medium text-white">
      Choose CSV or TSV · Processed locally
      <input aria-label="CSV file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"
        className="mt-2 block w-full max-w-xl rounded-lg border border-white/20 bg-surface-dark px-3 py-3 text-xs"
        onChange={async event => {
          try {
            const file = event.target.files[0];
            if (!file) return;
            importAbort.current?.abort();importAbort.current=new AbortController();
            setError('');setImportDiagnostics([]);setImportProgress({fileName:file.name,bytes:0,totalBytes:file.size,rows:0});setModelSelected(false);
            const summary=await importCsvFile(file,{signal:importAbort.current.signal,onProgress:setImportProgress,delimiter,quoteChar,encoding,hasHeader,decimalSeparator,schemaOverrides});
            const visibleHeaders=summary.headers;
            const visibleRows=summary.previewRows.map(row=>{const next=Object.create(null);next.id=row.id;for(const header of visibleHeaders)next[header]=row[header];return next;});
            const parsed={headers:visibleHeaders,originalHeaders:summary.originalHeaders,rows:visibleRows,rowCount:summary.previewRows.length,sourceSummary:summary,sourceRowCount:summary.sourceRows,sourceFile:file,sourceOptions:{delimiter,quoteChar,encoding,hasHeader,decimalSeparator,schemaOverrides},sampling:{kind:'source_preview',method:'first_records',rowCount:summary.previewRows.length}};
            setSourceSummary(summary);setData(parsed);setColumns(defaultPipelineColumns(parsed));
            onParsed?.(parsed,file.name);
            setError('');
            setImportProgress(null);
          } catch (reason) { if(reason.name!=='AbortError'){setError(reason.message);setImportDiagnostics(reason.diagnostics||[]);}setImportProgress(null); }
        }} />
    </label>
    <details className="max-w-xl rounded-xl border border-white/10 p-3"><summary className="cursor-pointer text-sm font-medium">Parsing preferences</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs">Delimiter<select aria-label="CSV delimiter" value={delimiter} onChange={e=>setDelimiter(e.target.value)} className="mt-1 block min-h-10 w-full rounded border border-white/20 bg-surface-dark p-2"><option value="auto">Detect automatically</option><option value=",">Comma</option><option value=";">Semicolon</option><option value="tab">Tab</option></select></label><label className="text-xs">Quote character<select aria-label="CSV quote character" value={quoteChar} onChange={e=>setQuoteChar(e.target.value)} className="mt-1 block min-h-10 w-full rounded border border-white/20 bg-surface-dark p-2"><option value={'"'}>Double quote</option><option value="'">Single quote</option></select></label><label className="text-xs">Encoding<select aria-label="CSV encoding" value={encoding} onChange={e=>setEncoding(e.target.value)} className="mt-1 block min-h-10 w-full rounded border border-white/20 bg-surface-dark p-2"><option value="utf-8">UTF-8</option><option value="utf-16le">UTF-16 little endian</option><option value="utf-16be">UTF-16 big endian</option><option value="iso-8859-1">ISO-8859-1</option></select></label><label className="text-xs">Decimal separator<select aria-label="Decimal separator" value={decimalSeparator} onChange={e=>setDecimalSeparator(e.target.value)} className="mt-1 block min-h-10 w-full rounded border border-white/20 bg-surface-dark p-2"><option value=".">Period (1.25)</option><option value=",">Comma (1,25)</option></select></label><label className="flex min-h-10 items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={hasHeader} onChange={e=>setHasHeader(e.target.checked)}/>First row contains column names</label></div></details>

    {importProgress&&<div className="max-w-xl rounded-xl border border-white/10 bg-surface-dark p-3 space-y-2" role="status" aria-live="polite">
      <p className="text-sm font-medium">Scanning {importProgress.fileName} locally</p>
      <progress className="w-full" max={importProgress.totalBytes||1} value={importProgress.bytes||0}/>
      <p className="text-xs text-text-muted">{Math.round((importProgress.bytes||0)/1024/1024)} of {Math.ceil((importProgress.totalBytes||0)/1024/1024)} MiB · {importProgress.rows.toLocaleString()} complete records</p>
      <button type="button" className="min-h-10 rounded border border-white/20 px-3" onClick={()=>importAbort.current?.abort()}>Cancel import</button>
    </div>}

    {sourceSummary&&<section id="prism-source-preparation" aria-label="Whole file profile" className="space-y-3 rounded-xl border border-cyan-400/20 bg-surface-dark p-3 sm:p-4">
      <h4 className="font-semibold">Whole-file overview · exact streamed profile</h4>
      <p className="text-sm text-text-muted">{sourceSummary.sourceRows.toLocaleString()} source rows · {sourceSummary.sourceColumns} columns · {(sourceSummary.fileBytes/1024/1024).toFixed(2)} MiB · {sourceSummary.delimiter==='tab'?'Tab separated':`“${sourceSummary.delimiter}” separated`}</p>
      <p className="text-xs text-text-muted">The sheet below shows the first 100 records and up to 100 columns. Numeric counts, missing values, minimum, maximum, mean and variance were computed across the complete source. Model preparation continues to use an explicit sample capped at 2,000 rows and 20 output features.</p>
      <div className="max-h-64 overflow-auto rounded-lg border border-white/10"><table className="w-full min-w-[560px] text-left text-xs"><caption className="p-2 text-left text-text-muted">Column profile · whole source stream</caption><thead><tr>{['Column','Inferred type','Observed','Missing','Minimum','Maximum','Mean'].map(x=><th scope="col" key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{sourceSummary.profile.map(col=><tr key={col.name} className="border-t border-white/10"><th scope="row" className="p-2">{col.name}</th><td className="p-2">{col.type}</td><td className="p-2">{col.count.toLocaleString()}</td><td className="p-2">{col.missingCount.toLocaleString()}</td><td className="p-2">{display(col.min)}</td><td className="p-2">{display(col.max)}</td><td className="p-2">{display(col.mean)}</td></tr>)}</tbody></table></div>
      <details className="rounded-lg border border-white/10 p-3"><summary className="cursor-pointer text-sm font-medium">Column type overrides</summary><p className="my-2 text-xs text-text-muted">Choose a type to rescan the local source. Dates must use ISO format. Invalid values stop the import and include a downloadable diagnostic record.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{sourceSummary.headers.map((header,index)=><label key={header} className="text-xs">{header}<select aria-label={`Type override ${header}`} value={schemaOverrides[header]||'auto'} onChange={event=>setSchemaOverrides(previous=>{const next={...previous};if(event.target.value==='auto')delete next[header];else next[header]=event.target.value;return next;})} className="mt-1 block min-h-10 w-full rounded border border-white/20 bg-surface-dark p-2"><option value="auto">Inferred ({sourceSummary.profile[index]?.inferredType||sourceSummary.profile[index]?.type||'unknown'})</option><option value="numeric">Numeric</option><option value="text">Text</option><option value="boolean">Boolean</option><option value="date">Date (ISO)</option></select></label>)}</div></details>
      <label className="block max-w-sm text-xs">Model sample rows: {Math.min(modelSampleSize,sourceSummary.sampleRows.length).toLocaleString()} of {sourceSummary.sourceRows.toLocaleString()}<input aria-label="Model sample size" type="range" min="100" max={Math.max(100,sourceSummary.sampleRows.length)} step="100" value={Math.min(modelSampleSize,Math.max(100,sourceSummary.sampleRows.length))} onChange={event=>setModelSampleSize(Number(event.target.value))} className="mt-2 block w-full"/><span className="text-text-muted">The seeded sample is capped at {sourceSummary.sampleRows.length.toLocaleString()} records.</span></label>
      <button type="button" disabled={Boolean(sourceEditError)} className="min-h-11 rounded-xl bg-cyan-700 px-4 py-2 font-semibold text-white" onClick={()=>{
        const sampleRows=sourceSummary.sampleRows.slice(0,Math.min(modelSampleSize,sourceSummary.sampleRows.length)).map(row=>{const next=Object.create(null);next.id=row.id;for(const header of data.headers){const key=JSON.stringify([row.id,header]);next[header]=Object.hasOwn(sourceEdits,key)?sourceEdits[key]:row[header];}return next;});
        const selected={...data,rows:sampleRows,rowCount:sampleRows.length,sourceSummary,sourceRowCount:sourceSummary.sourceRows,modelSelection:{explicit:true,method:'seeded_reservoir_sample',seed:sourceSummary.chartSample.seed,sourceRows:sourceSummary.sourceRows,selectedRows:sampleRows.length}};
        setData(selected);setColumns(defaultPipelineColumns(selected));setModelSelected(true);setSampleEditRevision(sourceEditRevision);onSampleSelected?.(selected);setError('');
      }}>Use a reproducible sample for model preparation</button>
      {modelSelected&&data?.modelSelection&&<p role="status" className="text-xs">Explicit model sample: {data.modelSelection.selectedRows.toLocaleString()} of {data.modelSelection.sourceRows.toLocaleString()} source rows · seeded reservoir sample · Seed {data.modelSelection.seed}.</p>}
      {sourceEditError&&<p role="alert" className="text-xs text-signal-amber">{sourceEditError}</p>}
      {sampleEditsChanged&&<p role="status" className="text-xs text-signal-amber">Source edits changed after this model sample was selected. Select the reproducible sample again to include the latest values before launching a lab.</p>}
      {!fullSourceOpened&&data?.sourceFile&&<button type="button" className="prism-ui-button" onClick={()=>setFullSourceOpened(true)}>Open full-source model fitting</button>}
      {fullSourceOpened&&data?.sourceFile&&<Suspense fallback={<p role="status">Loading full-source modeling…</p>}><FullSourceModeling key={sourceSummary.sourceFingerprint.value} dataset={data}/></Suspense>}
    </section>}

    {data?.academy?.taskType==='clustering'&&<p role="note" className="rounded-lg border border-cyan-400/20 p-3 text-sm">This case is unsupervised and has no target column. Use the case’s K-means lesson to start clustering; supervised target and split controls are hidden here.</p>}
    {data && data.academy?.taskType!=='clustering' && modelSelected && !sampleEditsChanged && !sourceEditError && <>
      <p className="text-sm text-text-muted">{data.modelSelection?`${data.modelSelection.selectedRows.toLocaleString()} explicitly sampled model rows of ${data.sourceRowCount.toLocaleString()} source rows`: `${data.rowCount} source rows`} · {data.headers.length} model-available columns · All data remains local</p>
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Feature and target selection">
        {['x', 'y', 'target'].map(key => <label key={key} className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
          {key === 'target' ? 'Target (binary)' : 'Feature ' + key.toUpperCase()}
          <select aria-label={'CSV ' + key} value={columns[key]} onChange={event => {
            setColumns(previous => ({...previous, [key]:event.target.value}));
            setError('');
          }} className="mt-1.5 block min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-surface-dark px-2 text-sm text-white">
            {!columns[key] && <option value="">Select a column</option>}
            {data.headers.map(header => <option key={header} value={header}>{header}</option>)}
          </select>
        </label>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Pipeline settings">
        <label className="text-xs font-semibold text-text-muted">Missing values
          <select aria-label="CSV imputation" value={imputation} onChange={event => {setImputation(event.target.value);setError('');}}
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-white/20 bg-surface-dark px-2 text-sm text-white">
            <option value="mean">Training mean</option><option value="median">Training median</option><option value="none">No imputation</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-text-muted">Feature scaling
          <select aria-label="CSV scaling" value={scaling} onChange={event => {setScaling(event.target.value);setError('');}}
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-white/20 bg-surface-dark px-2 text-sm text-white">
            <option value="standardize">Standardize</option><option value="minmax">Min-max</option><option value="none">None</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-text-muted">Train / validation / test
          <select aria-label="CSV split preset" value={splitPreset} onChange={event => {setSplitPreset(event.target.value);setError('');}}
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-white/20 bg-surface-dark px-2 text-sm text-white">
            {Object.keys(SPLIT_PRESETS).map(preset => <option key={preset}>{preset}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-text-muted">Reproducible split seed
          <input aria-label="CSV split seed" type="number" min="0" max="4294967295" step="1" value={seed}
            onChange={event => {setSeed(Number(event.target.value));setError('');}}
            className="mt-1.5 block min-h-11 w-full rounded-lg border border-white/20 bg-surface-dark px-2 text-sm text-white"/>
        </label>
      </div>
      <h4 className="text-sm font-semibold text-white">Pipeline graph</h4>
      <ol aria-label="Visual pipeline stages" className="grid gap-2 md:grid-cols-5">
        {(result.plan?.stages ?? [
          {id:'source',title:'Select columns',detail:'Choose columns'},
          {id:'split',title:'Stratified split',detail:splitPreset},
          {id:'impute',title:'Missing values',detail:imputation},
          {id:'scale',title:'Scaling',detail:scaling},
          {id:'output',title:'Two-feature lab',detail:'Awaiting valid inputs'},
        ]).map((stage, index) => <li key={stage.id} className="min-w-0 rounded-xl border border-cyan-400/20 bg-surface-dark p-3">
          <span className="font-mono text-[10px] text-cyan-300">STEP {index+1}/5</span>
          <p className="mt-1 text-sm font-semibold text-white">{stage.title}</p>
          <p className="mt-1 break-words text-xs text-text-muted">{stage.detail}</p>
        </li>)}
      </ol>
      {result.issue && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">
        Pipeline preview unavailable: {result.issue}
      </p>}
      {result.plan && <div role="region" aria-label="Leakage-safe pipeline preview" className="space-y-3 rounded-xl border border-emerald-400/20 bg-surface-dark p-3 sm:p-4">
        <p className="text-sm font-semibold text-emerald-200">Pipeline ready · Train-only fitted statistics</p>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          {[['Train',result.plan.counts.train],['Validation',result.plan.counts.validation],['Test (held out)',result.plan.counts.test]].map(([label,value]) =>
            <div key={label} className="rounded-lg border border-white/10 bg-obsidian p-2">
              <dt className="text-[11px] text-text-muted">{label}</dt><dd className="font-semibold tabular-nums text-white">{value}</dd>
            </div>)}
        </dl>
        <div role="region" aria-label="Training-only fitted parameters" tabIndex={0} className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[480px] text-left text-xs">
            <caption className="p-3 text-left text-text-muted">Observed training features only — no validation or test statistics used</caption>
            <thead className="bg-surface-elevated"><tr>
              {['Feature','Training observed','Train missing','Train mean','Train median','Imputation value'].map(label=><th scope="col" key={label} className="p-2">{label}</th>)}
            </tr></thead>
            <tbody>{Object.entries(result.plan.statistics).map(([key,value])=><tr key={key} className="border-t border-white/10">
              <th scope="row" className="p-2">{columns[key]}</th><td className="p-2 tabular-nums">{value.count}</td>
              <td className="p-2 tabular-nums">{value.missingTraining}</td>
              <td className="p-2 tabular-nums">{display(value.mean)}</td>
              <td className="p-2 tabular-nums">{display(value.median)}</td>
              <td className="p-2 tabular-nums">{display(value.imputationValue)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div role="region" aria-label="Prepared row comparison" tabIndex={0} className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[600px] text-left text-xs">
            <caption className="p-3 text-left text-text-muted">First {result.plan.previews.length} original and transformed rows, labeled by split. Evaluation remains held out from fitting.</caption>
            <thead className="bg-surface-elevated"><tr>
              {['Source ID','Split','Original X','Original Y','Prepared X','Prepared Y'].map(label=><th scope="col" key={label} className="p-2">{label}</th>)}
            </tr></thead>
            <tbody>{result.plan.previews.map(row=><tr key={row.id} className="border-t border-white/10">
              <th scope="row" className="p-2">{row.id}</th><td className="p-2 capitalize">{row.partition}</td>
              <td className="p-2 tabular-nums">{display(row.originalX)}</td><td className="p-2 tabular-nums">{display(row.originalY)}</td>
              <td className="p-2 tabular-nums">{display(row.x)}</td><td className="p-2 tabular-nums">{display(row.y)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted">Changing inputs, split, or steps creates a new deterministic preview. Prepared features are transformed using training-derived parameters; labels are never imputed. No model is trained until you open a lab.</p>
      </div>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="min-h-11 rounded-xl bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-600"
          onClick={() => launch('playground')}>Prepare for Playground</button>
        <button type="button" className="min-h-11 rounded-xl border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/10"
          onClick={() => launch('studio')}>Prepare for Studio</button>
      </div>
      <PipelineStudio dataset={data} onLaunch={launchAdvanced}/>
    </>}
    {error && <div role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200"><p>{error}</p>{importDiagnostics.length>0&&<button type="button" className="mt-2 underline" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({kind:'neuroforge-csv-parse-diagnostics',schemaVersion:1,items:importDiagnostics.slice(0,100)},null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='csv-parse-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download parse diagnostics</button>}</div>}
  </section>;
}
