import { useMemo, useState } from 'react';
import { profileDataset, histogram } from '../../ml/datasetProfiling.js';
import { applyEdaFilters } from '../../ml/edaFilters.js';
import EdaFilterToolbar from './eda/EdaFilterToolbar.jsx';
import EdaMissingnessView from './eda/EdaMissingnessView.jsx';
import EdaQualityView from './eda/EdaQualityView.jsx';
import EdaCorrelationView from './eda/EdaCorrelationView.jsx';
import EdaRowExplorer from './eda/EdaRowExplorer.jsx';
import EdaReportPanel from './eda/EdaReportPanel.jsx';
import DatasetInvestigation from './DatasetInvestigation.jsx';
import AlgorithmInsights from './AlgorithmInsights.jsx';

const format = value => Number.isFinite(value)
  ? (Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value.toFixed(2))
  : 'Not available';

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-obsidian p-3">
    <dt className="text-xs text-text-muted">{label}</dt>
    <dd className="mt-1 text-xl font-semibold text-white tabular-nums">{value}</dd>
  </div>;
}

function Distribution({ column, rows, binCount }) {
  const bars = column.type === 'numeric'
    ? histogram(rows.map(row => row[column.name]).filter(Number.isFinite), binCount).map(bin => ({ label: bin.from === bin.to ? format(bin.from) : `${format(bin.from)} to ${format(bin.to)}`, count: bin.count }))
    : column.categories;
  const max = Math.max(1, ...bars.map(bar => bar.count));
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.65fr)]">
    <div className="rounded-xl border border-white/10 bg-obsidian p-3">
      <p className="mb-2 text-xs text-text-muted">{column.type === 'numeric' ? 'Observed numeric distribution' : 'Most frequent observed categories'} · Missing values excluded</p>
      {bars.length ? <svg role="img" aria-label={`${column.name} distribution: ${bars.map(bar => `${bar.label}, ${bar.count} rows`).join('; ')}`}
        viewBox="0 0 520 240" className="w-full rounded-lg bg-deep-space" preserveAspectRatio="xMidYMid meet">
        <line x1="36" x2="504" y1="204" y2="204" stroke="#9EACC4" strokeWidth="1" />
        {bars.map((bar,index) => {
          const space = 468 / bars.length, x = 36 + index*space + 5;
          const height = bar.count/max * 160;
          return <g key={index}>
            <rect x={x} y={204-height} width={Math.max(3,space-10)} height={height} rx="3" fill={index%2 ? '#A78BFA' : '#46D7F2'} />
            <text x={x+(space-10)/2} y={198-height} fill="#F2F5FC" textAnchor="middle" fontSize="11">{bar.count}</text>
            <text x={x+(space-10)/2} y="224" fill="#9EACC4" textAnchor="middle" fontSize="10">{index+1}</text>
          </g>;
        })}
      </svg> : <p role="status" className="p-5 text-sm text-text-muted">No observed values to chart.</p>}
      <p className="mt-2 text-xs text-text-muted">Chart indexes correspond to the numbered groups in the table. Counts are actual rows, not percentages.</p>
    </div>
    <div tabIndex={0} role="region" aria-label="Distribution values" className="max-h-[330px] overflow-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-xs">
        <caption className="p-3 text-left text-text-muted">Distribution of {column.name}</caption>
        <thead className="bg-surface-elevated text-text-primary"><tr><th scope="col" className="p-2">Group</th><th scope="col" className="p-2">Range or category</th><th scope="col" className="p-2">Rows</th></tr></thead>
        <tbody>{bars.map((bar,index) => <tr key={index} className="border-t border-white/10">
          <th scope="row" className="p-2">{index+1}</th><td className="p-2 break-words">{bar.label}</td><td className="p-2 tabular-nums">{bar.count}</td>
        </tr>)}
        {!bars.length && <tr><td colSpan={3} className="p-3">No values recorded</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

export default function DataScienceWorkbench({ dataset, name, onCreateSubset }) {
  const [tab, setTab] = useState('overview');
  const [selectedColumn, setSelectedColumn] = useState(dataset?.headers?.[0] ?? '');
  const [filters, setFilters] = useState([]);
  const [binCount, setBinCount] = useState(8);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const filtered = useMemo(() => dataset ? applyEdaFilters(dataset, filters) : null, [dataset, filters]);
  const analyzedDataset = useMemo(() => dataset && filtered
    ? { headers: dataset.headers, rows: filtered.rows }
    : null, [dataset, filtered]);
  const report = useMemo(() => analyzedDataset ? profileDataset(analyzedDataset) : null, [analyzedDataset]);
  const inspectRow = id => { setSelectedRowId(id); setTab('rows'); };
  if (!report) return <div className="rounded-xl border border-dashed border-white/20 p-5 text-sm text-text-muted" role="status">
    Import a CSV using the form above, or select <strong className="text-white">Try sample dataset</strong> to explore statistical evidence. Processing stays entirely in this browser.
  </div>;

  const active = report.columns.find(column=>column.name===selectedColumn) ?? report.columns[0];
  const tabs = [{id:'overview',name:'Overview'}, {id:'distributions',name:'Distributions'}, {id:'relationships',name:'Relationships'}, {id:'balance',name:'Class balance'}, {id:'outliers',name:'Outliers & quality'}, {id:'algorithms',name:'Algorithms'}, {id:'correlations',name:'Correlations'}, {id:'missingness',name:'Missingness'}, {id:'quality-pro',name:'Quality Pro'}, {id:'rows',name:'Row Explorer'}, {id:'evidence',name:'Evidence & export'}, {id:'preview',name:'Row preview'}];
  return <section role="region" aria-label="Dataset profile dashboard" className="space-y-4 rounded-xl border border-white/10 bg-surface-dark p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h4 className="text-lg font-semibold text-white">Exploratory data analysis</h4>
        <p className="text-xs text-text-muted">Source: {name || 'Imported CSV'} · {filtered.sourceCount} original / {filtered.visibleCount} analyzed · Exploratory statistics only.</p>
      </div>
      <span className="rounded-full border border-emerald-400/25 px-3 py-1 text-xs text-emerald-200">Local-only analysis</span>
    </div>
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Metric label="Rows" value={report.rowCount} />
      <Metric label="Columns" value={report.columnCount} />
      <Metric label="Missing cells" value={report.missingCells} />
      <Metric label="Duplicate rows" value={report.duplicateRows} />
    </dl>
    <EdaFilterToolbar headers={dataset.headers} filters={filters} onChange={setFilters} sourceCount={filtered.sourceCount} visibleCount={filtered.visibleCount} />
    <div role="group" aria-label="Workbench views" className="flex flex-wrap gap-2">
      {tabs.map(item => <button key={item.id} type="button" aria-pressed={tab===item.id} onClick={()=>setTab(item.id)}
        className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${tab===item.id ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-obsidian text-text-muted hover:text-white'}`}>
        {item.name}
      </button>)}
    </div>
    {tab==='overview' && <div className="space-y-3">
      <p className="text-xs text-text-muted">Numeric summaries use only observed finite values. Missingness counts exclude empty, null and NaN fields.</p>
      <div role="region" aria-label="Column quality profile" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[680px] text-left text-xs">
          <caption className="p-3 text-left font-semibold text-white">Column summary and missingness</caption>
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
      <label className="block max-w-xs text-xs text-text-muted">Histogram bins: {binCount}
        <input type="range" aria-label="Histogram bins" min="4" max="16" step="1" value={binCount} onChange={event=>setBinCount(Number(event.target.value))} className="mt-2 block w-full" />
      </label>
      <Distribution column={active} rows={analyzedDataset.rows} binCount={binCount}/>
    </div>}
    {['relationships','balance','outliers'].includes(tab) && <DatasetInvestigation dataset={analyzedDataset} report={report} mode={tab} onSelectRow={inspectRow} />}
    {tab==='algorithms' && <AlgorithmInsights dataset={analyzedDataset} report={report} />}
    {tab==='correlations' && <EdaCorrelationView dataset={analyzedDataset} onInspectRow={inspectRow}/>}
    {tab==='missingness' && <EdaMissingnessView dataset={analyzedDataset} onInspectRow={inspectRow}/>}
    {tab==='quality-pro' && <EdaQualityView dataset={analyzedDataset} onInspectRow={inspectRow}/>}
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
