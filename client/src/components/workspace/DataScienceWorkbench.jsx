import { lazy,Suspense,useMemo, useState } from 'react';
import {PrismMetric,PrismTabs} from '../../design/components/Prism.jsx';
import { profileDataset } from '../../ml/datasetProfiling.js';
import ScientificHistogram from './charts/ScientificHistogram.jsx';
import { applyEdaFilters } from '../../ml/edaFilters.js';
import EdaFilterToolbar from './eda/EdaFilterToolbar.jsx';
import EdaMissingnessView from './eda/EdaMissingnessView.jsx';
import EdaQualityView from './eda/EdaQualityView.jsx';
import EdaCorrelationView from './eda/EdaCorrelationView.jsx';
import EdaRowExplorer from './eda/EdaRowExplorer.jsx';
import DataSheetWorkspace from './datasheet/DataSheetWorkspace.jsx';
import CsvSourcePager from './CsvSourcePager.jsx';
import EdaReportPanel from './eda/EdaReportPanel.jsx';
import DatasetInvestigation from './DatasetInvestigation.jsx';
import AlgorithmInsights from './AlgorithmInsights.jsx';
const ChartStudio=lazy(()=>import('./charts/ChartStudio.jsx'));

const format = value => Number.isFinite(value)
  ? (Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value.toFixed(2))
  : 'Not available';

function Metric({ label, value }) {
  return <PrismMetric label={label} value={value} formatted/>;
}

function CategoricalDistribution({ column }) {
  const bars = column.categories;
  const max=Math.max(1,...bars.map(bar=>bar.count));
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.65fr)]">
    <div className="rounded-xl border border-white/10 bg-obsidian p-4">
      <p className="mb-4 text-sm font-medium">Most frequent categories · Missing values excluded</p>
      {bars.length?<div role="img" aria-label={column.name+' categorical counts: '+bars.map(b=>b.label+' '+b.count).join('; ')}
        className="space-y-3">
        {bars.map((bar,i)=><div key={i} className="space-y-1">
          <div className="flex justify-between gap-2 text-xs text-text-muted">
            <span className="truncate">{bar.label}</span><span className="tabular-nums">{bar.count}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full rounded-full bg-plasma-cyan/70" style={{width:(bar.count/max*100)+'%'}}/>
          </div>
        </div>)}
      </div>:<p role="status" className="text-sm text-text-muted">No observed categories.</p>}
    </div>
    <div role="region" tabIndex={0} aria-label="Distribution values" className="max-h-[350px] overflow-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-xs">
        <caption className="p-3 text-left text-text-muted">Distribution of {column.name}</caption>
        <thead className="bg-surface-elevated"><tr><th scope="col" className="p-2">Category</th><th scope="col" className="p-2">Rows</th></tr></thead>
        <tbody>{bars.map((bar,index)=><tr className="border-t border-white/10" key={index}>
          <th scope="row" className="p-2 break-words">{bar.label}</th>
          <td className="p-2 tabular-nums">{bar.count}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

export default function DataScienceWorkbench({ dataset, name, onCreateSubset, onCommitVersion, recovery }) {
  const [tab, setTab] = useState(recovery?'datasheet':'overview');
  const [analysisIds,setAnalysisIds]=useState(null);
  const [studioRequest,setStudioRequest]=useState(null);
  const [studioOpened,setStudioOpened]=useState(false);
  const [linkedIds,setLinkedIds]=useState([]);
  const [selectedColumn, setSelectedColumn] = useState(dataset?.headers?.[0] ?? '');
  const [filters, setFilters] = useState([]);
  const [binCount, setBinCount] = useState(8);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const filtered = useMemo(() => dataset ? applyEdaFilters(dataset, filters) : null, [dataset, filters]);
  const analyzedDataset = useMemo(() => dataset && filtered
    ? { headers: dataset.headers, rows: analysisIds?filtered.rows.filter(row=>analysisIds.includes(row.id)):filtered.rows }
    : null, [dataset, filtered, analysisIds]);
  const report = useMemo(() => analyzedDataset ? profileDataset(analyzedDataset) : null, [analyzedDataset]);
  const inspectRow = id => { setSelectedRowId(id); setTab('rows'); };
  if (!report) return <div className="rounded-xl border border-dashed border-white/20 p-5 text-sm text-text-muted" role="status">
    Import a CSV using the form above, or select <strong className="text-white">Try sample dataset</strong> to explore statistical evidence. Processing stays entirely in this browser.
  </div>;

  const active = report.columns.find(column=>column.name===selectedColumn) ?? report.columns[0];
  const wholeSourceRows=dataset.sourceSummary?.sourceRows??dataset.sourceRowCount??filtered.sourceCount;
  const isPreview=Boolean(dataset.sourceSummary);
  const sampleLabel=dataset.modelSelection?'Seeded reservoir sample':isPreview?'First-record preview':'source data';
  const tabs = [{id:'overview',name:'Overview'}, ...(dataset.sourceFile?[{id:'full-source',name:'Full source pages'}]:[]), {id:'distributions',name:'Distributions'}, {id:'chart-studio',name:'Chart Studio'}, {id:'relationships',name:'Relationships'}, {id:'balance',name:'Class balance'}, {id:'outliers',name:'Outliers & quality'}, {id:'algorithms',name:'Algorithms'}, {id:'correlations',name:'Correlations'}, {id:'missingness',name:'Missingness'}, {id:'quality-pro',name:'Quality Pro'}, {id:'datasheet',name:'DataSheet'}, {id:'rows',name:'Row Explorer'}, {id:'evidence',name:'Evidence & export'}, {id:'preview',name:'Row preview'}];
  return <section id="prism-analysis" role="region" aria-label="Dataset profile dashboard" className="prism-lab space-y-5 rounded-2xl border border-white/10 bg-surface-dark p-3 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="prism-eyebrow mb-2">NEUROFORGE / PRISM RESEARCH CANVAS</div>
        <h4 className="font-display text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">Exploratory data analysis</h4>
        <p className="text-xs text-text-muted">Source: {name || 'Imported CSV'} · {isPreview?`${report.rowCount} ${dataset.modelSelection?'sample':'preview'} rows analyzed; ${wholeSourceRows.toLocaleString()} source rows profiled`:`${filtered.sourceCount} source rows / ${report.rowCount} analyzed`} · Exploratory statistics only.</p>
      </div>
      <span className="prism-status-pill">Local-only analysis · {isPreview?'preview sample':'source data'}</span>
    </div>
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Metric label="Rows" value={report.rowCount} />
      <Metric label="Columns" value={report.columnCount} />
      <Metric label="Missing cells" value={report.missingCells} />
      <Metric label="Duplicate rows" value={report.duplicateRows} />
    </dl>
    <div className="prism-scope-bar" aria-label="Active analysis population"><strong>{analysisIds?'Selected observations':filters.length?'Filtered view':sampleLabel}</strong><span>{report.rowCount} analyzed · {isPreview?`${wholeSourceRows.toLocaleString()} whole-source rows`:`${filtered.sourceCount} source rows`}</span><span>{isPreview?'Sample-derived summaries; exact whole-file profile shown above.':`Source version: ${dataset.provenance?.versionId||'Imported source'}`}</span></div>
    {analysisIds&&<button type="button" onClick={()=>setAnalysisIds(null)}>Clear DataSheet analysis scope ({analysisIds.length} selected observations)</button>}
    <EdaFilterToolbar headers={dataset.headers} filters={filters} onChange={setFilters} sourceCount={filtered.sourceCount} visibleCount={filtered.visibleCount} />
    <PrismTabs buttons label="Workbench views" value={tab} items={tabs.map(t=>({value:t.id,label:t.name}))} onChange={value=>{if(value==='chart-studio')setStudioOpened(true);setTab(value);}}/>
    {tab==='overview' && <div className="space-y-3">
      <p className="text-xs text-text-muted">Numeric summaries use only observed finite values. Missingness counts exclude empty, null and NaN fields.</p>
      <div role="region" aria-label="Column quality profile" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[680px] text-left text-xs">
          <caption className="p-3 text-left font-semibold text-white">{isPreview?'Preview sample column summary and missingness':'Column summary and missingness'}</caption>
          <thead className="bg-surface-elevated"><tr>{['Column','Inferred type','Observed','Missing','Distinct','Mean','Median','Min','Max'].map(h=><th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
          <tbody>{report.columns.map(col=><tr key={col.name} className="border-t border-white/10">
            <th scope="row" className="p-2 font-semibold">{col.name}</th>
            <td className="p-2">{col.type}</td><td className="p-2 tabular-nums">{col.present}</td>
            <td className="p-2 tabular-nums">{col.missing} ({(100*col.missing/Math.max(1,report.rowCount)).toFixed(1)}%)</td>
            <td className="p-2 tabular-nums">{col.unique}</td>
            <td className="p-2 tabular-nums">{format(col.mean)}</td>
            <td className="p-2 tabular-nums">{format(col.median)}</td>
            <td className="p-2 tabular-nums">{format(col.min)}</td>
            <td className="p-2 tabular-nums">{format(col.max)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {report.duplicateRows>0 && <p className="text-xs text-amber-200">Duplicate rows are counted by original CSV columns, excluding generated row identifiers. Review whether duplicates are expected before removing them.</p>}
    </div>}
    {tab==='full-source'&&<CsvSourcePager dataset={dataset}/>}
    {tab==='distributions' && <div className="space-y-3">
      <label className="block text-sm font-medium text-white">Feature to inspect
        <select aria-label="Distribution column" value={active.name} onChange={event=>setSelectedColumn(event.target.value)}
          className="mt-2 block min-h-11 w-full max-w-sm rounded-lg border border-white/20 bg-obsidian p-2 text-sm text-white">
          {report.columns.map(col=><option key={col.name} value={col.name}>{col.name} · {col.type}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-3 text-xs text-text-muted">
        <span>Observed: {active.present}</span><span>Missing: {active.missing}</span><span>Unique: {active.unique}</span>
        {active.type==='numeric' && <><span>Q1: {format(active.q1)}</span><span>Q3: {format(active.q3)}</span><span>Sample SD: {format(active.standardDeviation)}</span></>}
      </div>
      {active.type==='numeric'&&<label className="block max-w-xs text-xs text-text-muted">Histogram bins: {binCount}
        <input type="range" aria-label="Histogram bins" min="4" max="16" step="1" value={binCount} onChange={event=>setBinCount(Number(event.target.value))} className="mt-2 block w-full" />
      </label>}
      {active.type==='numeric'
        ?<ScientificHistogram dataset={analyzedDataset} column={active.name} binCount={binCount}
          sourceName={name||'Imported CSV'} sourceCount={filtered.sourceCount}
          onOpenStudio={()=>{setStudioRequest({dataset:analyzedDataset,sourceDataset:dataset,population:filters.length||analysisIds?'filtered_source':'source',columns:[active.name],type:'histogram'});setTab('chart-studio');}}/>
        :<CategoricalDistribution column={active}/>} 
    </div>}
    {['relationships','balance','outliers'].includes(tab) && <DatasetInvestigation dataset={analyzedDataset} report={report} mode={tab} onSelectRow={inspectRow} />}
    {tab==='algorithms' && <AlgorithmInsights dataset={analyzedDataset} report={report} />}
    {tab==='correlations' && <EdaCorrelationView dataset={analyzedDataset} onInspectRow={inspectRow}/>}
    {tab==='missingness' && <EdaMissingnessView dataset={analyzedDataset} onInspectRow={inspectRow}/>}
    {tab==='quality-pro' && <EdaQualityView dataset={analyzedDataset} onInspectRow={inspectRow}/>}
    {(studioOpened||studioRequest)&&<div hidden={tab!=='chart-studio'}><Suspense fallback={<p role="status">Loading Chart Studio…</p>}><ChartStudio active={tab==='chart-studio'}
      key={studioRequest?.key||JSON.stringify([studioRequest?.columns,studioRequest?.population,filters,analysisIds])}
      dataset={studioRequest?.dataset||analyzedDataset} sourceDataset={studioRequest?.sourceDataset||dataset}
      population={studioRequest?.population||(filters.length||analysisIds?'filtered_source':'source')} sourceName={name}
      populationCount={!filters.length&&!analysisIds&&dataset.sourceSummary?dataset.sourceSummary.sourceRows:(studioRequest?.sourceDataset||dataset).rows.length}
      sampling={!filters.length&&!analysisIds&&dataset.sourceSummary?{method:'first_records_preview',statisticsAreSampleDerived:true}:null}
      initialColumns={studioRequest?.columns} initialType={studioRequest?.type}
      onLink={ids=>setLinkedIds(ids)} onShowSheet={()=>setTab('datasheet')}
      onFilterMissing={column=>{setFilters(previous=>[...previous,{id:crypto.randomUUID(),column,operator:'missing'}]);setStudioRequest(null);setTab('datasheet');}}/></Suspense></div>}
    {dataset&&<div hidden={tab!=='datasheet'}><DataSheetWorkspace dataset={dataset} filters={filters} name={name} recovery={recovery} selectedRowId={selectedRowId} onBrowseFullSource={dataset.sourceFile?()=>setTab('full-source'):null}
      onSelectRow={setSelectedRowId} onInspectRow={inspectRow} onCommit={onCommitVersion} highlightedRowIds={linkedIds}
      onChart={request=>{setStudioRequest({...request,key:crypto.randomUUID()});setTab('chart-studio');}}
      onAnalyze={(ids,column)=>{setAnalysisIds(ids);if(column)setSelectedColumn(column);setTab('distributions');}}/></div>}
    {tab==='rows' && <EdaRowExplorer dataset={analyzedDataset} selectedRowId={selectedRowId} onSelectRow={setSelectedRowId}/>}
    {tab==='evidence' && <EdaReportPanel source={dataset} filteredRows={analyzedDataset.rows}
      filters={filters} sourceName={name || 'Imported CSV'} onCreateSubset={onCreateSubset}/>}
    {tab==='preview' && <div role="region" aria-label="Uploaded row preview" tabIndex={0} className="max-w-full overflow-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[500px] text-left text-xs">
        <caption className="p-3 text-left text-text-muted">First {Math.min(12,report.rowCount)} of {report.rowCount} rows. Original values only; no imputation or scaling applied.</caption>
        <thead className="bg-surface-elevated"><tr>{analyzedDataset.headers.map(header=><th key={header} scope="col" className="p-2">{header}</th>)}</tr></thead>
        <tbody>{analyzedDataset.rows.slice(0,12).map((row,index)=><tr key={row.id??index} className="border-t border-white/10">
          {analyzedDataset.headers.map(header=><td key={header} className="p-2">{row[header] === null || row[header] === undefined ? <span className="text-amber-200">Missing</span> : String(row[header])}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
