import DatasetPreparation from '../components/workspace/DatasetPreparation.jsx';
import { DataSheetRecovery } from '../components/workspace/datasheet/DataSheetWorkspace.jsx';
import DataScienceWorkbench from '../components/workspace/DataScienceWorkbench.jsx';
import { parseAndValidateCSV } from '../ml/datasetImport.js';
import { isFeatureEnabled } from '../services/productionConfig.js';
import React, { useMemo, useState } from 'react';
import { useNavigate,useSearchParams } from 'react-router-dom';
import ResearchPageHeader from '../design/patterns/ResearchPageHeader.jsx';
import DatasetStages from '../design/patterns/DatasetStages.jsx';
import { generateTwoMoons, generateXOR, generateGaussianBlobs, generateLinearTrend, generateConcentricCircles, generateSpiral, trainTestSplit } from '../ml/datasets';
import { useLabStore } from '../store/useLabStore';
import {generateAcademyCase} from '../academy/cases/catalog.js';
const presets = { 'Two Moons': generateTwoMoons, 'XOR Problem': generateXOR, 'Gaussian Blobs': generateGaussianBlobs, 'Linear Trend': generateLinearTrend, 'Concentric Circles': generateConcentricCircles, Spiral: generateSpiral };
export default function DatasetsPage() {
  const [params]=useSearchParams();
  const [name, setName] = useState('Two Moons');
  const [exploredFile, setExploredFile] = useState(null);
  const [datasetRevision, setDatasetRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [noise, setNoise] = useState(.15);
  const [count, setCount] = useState(200);
  const [ratio, setRatio] = useState(.8);
  const {loadRun,setExperimentName} = useLabStore();
  const navigate = useNavigate();
  const points = useMemo(() => presets[name](count, noise, 42),[name,count,noise]);
  const academyCaseId=params.get('source')==='academy'?params.get('case'):null;
  const academyImport=useMemo(()=>{if(!academyCaseId)return null;try{const {spec,rows}=generateAcademyCase(academyCaseId),headers=[...spec.features,...(spec.target?[spec.target]:[])];const dataRows=rows.map((record,index)=>{const row=Object.create(null);row.id=`academy-${spec.seed}-${index}`;for(const header of headers)row[header]=record[header]??null;return row;});return {data:{headers,rows:dataRows,rowCount:dataRows.length,provenance:{kind:'synthetic-academy-case',caseId:spec.id,seed:spec.seed}},name:`${spec.title} · deterministic synthetic seed ${spec.seed}`};}catch{return null;}},[academyCaseId]);
  const activeFile=academyImport||exploredFile;
  const split = useMemo(() => trainTestSplit(points,ratio,42),[points,ratio]);
  const colors = ['#46D7F2','#A78BFA','#3CD5AA'];
  const extent = Math.max(2.5,...points.flatMap(p => [Math.abs(p.x),Math.abs(p.y)]));
  const loadSampleForAnalysis = () => {
    const sample = generateTwoMoons(120, .15, 42);
    const csv = ['feature_x,feature_y,label',
      ...sample.map(point => [point.x, point.y, point.label].join(','))].join('\n');
    const data = parseAndValidateCSV(csv, { requiredNumericCols: 0 });
    setExploredFile({ data, name: 'Two Moons sample (seed 42)' });
    setDatasetRevision(previous => previous + 1);
  };
  const launch = () => {
    const algorithm = name === 'Linear Trend' ? 'Linear Regression' : name === 'Gaussian Blobs' ? 'K-Means Clustering' : 'Logistic Regression';
    loadRun({workspace:'playground',algorithm,dataset:{name,points,noise,trainRatio:ratio,seed:42},hyperparameters:{}});
    setExperimentName(`${name} investigation`); navigate('/app/playground');
  };
  return <div className="p-6 space-y-5 max-w-6xl mx-auto w-full">
    <ResearchPageHeader eyebrow="Data / Investigation" title="Dataset Explorer & Microscope" description="Follow the evidence from original values through exploration, working copies, fitted preprocessing and model evaluation."/>
    <DatasetStages dataset={activeFile?.data} name={activeFile?.name} modeling={params.get('stage')==='modeling'}/>
    {isFeatureEnabled('anti_leakage_prep') && (
      <section aria-label="Data Science Workbench" className="space-y-4 rounded-2xl border border-cyan-400/20 bg-surface-dark p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">Data Science Workbench</h3>
            <p className="mt-1 max-w-2xl text-sm text-text-muted">Explore real CSV columns, missingness and relationships locally before preparing a leakage-safe model.</p>
          </div>
          <button type="button" onClick={loadSampleForAnalysis}
            className="rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20">
            Try sample dataset
          </button>
        </div>
        <div id="prism-import"><DataSheetRecovery onRecover={record=>{
          setExploredFile(record.version?{data:record.version,name:record.name+' · committed version'}:{data:record.source,name:record.name,recovery:record});
          setDatasetRevision(previous=>previous+1);
        }}/>
        <DatasetPreparation key={'preparation-'+datasetRevision} initialData={activeFile?.data}
          onSampleSelected={data=>setExploredFile(previous=>previous?{...previous,data}:previous)}
          onParsed={(data, fileName) => {
            setExploredFile(data ? { data, name: fileName } : null);
            setDatasetRevision(previous => previous + 1);
          }} /></div>
        <DataScienceWorkbench key={'workbench-'+datasetRevision} dataset={activeFile?.data} name={activeFile?.name}
          recovery={activeFile?.recovery}
          onCommitVersion={(data,fileName)=>{setExploredFile({data,name:fileName});setDatasetRevision(previous=>previous+1);}}
          onCreateSubset={rows => {
            if (!activeFile?.data || rows.length < 4) return;
            const subset = {
              ...activeFile.data,
              rows: rows.map(row => ({ ...row })),
              rowCount: rows.length,
            };
            setExploredFile({ data: subset, name: activeFile.name + ' · selected subset' });
            setDatasetRevision(previous => previous + 1);
          }} onSampleSelected={data=>setExploredFile(previous=>previous?{...previous,data,name:previous.name+' · explicit seeded sample'}:previous)} />
      </section>
    )}
    <label className="block text-sm">Search datasets<input aria-label="Search datasets" className="block p-2 bg-obsidian rounded w-full" value={query} onChange={e=>setQuery(e.target.value)} /></label>
    <div className="flex flex-wrap gap-2">{Object.keys(presets).filter(n=>n.toLowerCase().includes(query.toLowerCase())).map(n=><button key={n} aria-pressed={name===n} onClick={()=>setName(n)} className={`p-2 rounded border ${name===n?'border-cyan-300':'border-white/10'}`}>{n}</button>)}</div>
    <div className="grid lg:grid-cols-[1fr_260px] gap-5">
      <svg role="img" aria-label={`${name} with ${points.length} points; validation points are hollow`} viewBox="0 0 400 400" className="bg-obsidian rounded-xl w-full max-h-[500px]">
        <line x1="200" y1="0" x2="200" y2="400" stroke="#9EACC4" opacity=".3"/><line x1="0" y1="200" x2="400" y2="200" stroke="#9EACC4" opacity=".3"/>
        {split.all.map(p=><circle key={p.id} cx={200+p.x/extent*180} cy={200-p.y/extent*180} r="3" stroke={colors[p.label]} fill={p.isTest?'none':colors[p.label]}><title>{`Class ${p.label}; x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}; ${p.isTest?'validation':'training'}`}</title></circle>)}
      </svg>
      <div className="space-y-5 text-sm">
        <label className="block">Samples: {points.length}<input aria-label="Sample count" className="w-full" type="range" min="40" max="400" step="12" value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
        <label className="block">Noise: {noise.toFixed(2)}<input aria-label="Dataset noise" className="w-full" type="range" min="0" max="0.6" step="0.01" value={noise} onChange={e=>setNoise(Number(e.target.value))}/></label>
        <label className="block">Training split: {(ratio*100).toFixed(0)}%<input aria-label="Training split" className="w-full" type="range" min="0.5" max="0.9" step="0.05" value={ratio} onChange={e=>setRatio(Number(e.target.value))}/></label>
        <p>{split.train.length} training · {split.test.length} validation. Hollow points are held out.</p>
        {name!=='Linear Trend' && <ul>{[...new Set(points.map(p=>p.label))].map(label=><li key={label}>Class {label}: {points.filter(p=>p.label===label).length} samples</li>)}</ul>}
        <p className="text-slate-400 text-xs">Seed 42. Keep evaluation points isolated from fitting. Changing noise or samples creates a different dataset.</p>
        <button onClick={launch} className="p-3 rounded bg-cyan-300 text-slate-950 font-semibold">Open this dataset in Lab</button>
      </div>
    </div>
  </div>;
}
