import { useMemo, useState } from 'react';
import { profileDataset } from '../../ml/datasetProfiling.js';
import DatasetInvestigation from './DatasetInvestigation.jsx';

const format = value => Number.isFinite(value)
  ? (Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value.toFixed(2))
  : 'Not available';

function Metric({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-[#151E30] p-3">
    <dt className="text-xs text-[#9EACC4]">{label}</dt>
    <dd className="mt-1 text-xl font-semibold text-white tabular-nums">{value}</dd>
  </div>;
}

function Distribution({ column }) {
  const bars = column.type === 'numeric'
    ? column.histogram.map(bin => ({ label: bin.from === bin.to ? format(bin.from) : `${format(bin.from)} to ${format(bin.to)}`, count: bin.count }))
    : column.categories;
  const max = Math.max(1, ...bars.map(bar => bar.count));
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.65fr)]">
    <div className="rounded-xl border border-white/10 bg-[#151E30] p-3">
      <p className="mb-2 text-xs text-[#9EACC4]">{column.type === 'numeric' ? 'Observed numeric distribution' : 'Most frequent observed categories'} · Missing values excluded</p>
      {bars.length ? <svg role="img" aria-label={`${column.name} distribution: ${bars.map(bar => `${bar.label}, ${bar.count} rows`).join('; ')}`}
        viewBox="0 0 520 240" className="w-full rounded-lg bg-[#080D18]" preserveAspectRatio="xMidYMid meet">
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
      </svg> : <p role="status" className="p-5 text-sm text-[#9EACC4]">No observed values to chart.</p>}
      <p className="mt-2 text-xs text-[#9EACC4]">Chart indexes correspond to the numbered groups in the table. Counts are actual rows, not percentages.</p>
    </div>
    <div tabIndex={0} role="region" aria-label="Distribution values" className="max-h-[330px] overflow-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-xs">
        <caption className="p-3 text-left text-[#9EACC4]">Distribution of {column.name}</caption>
        <thead className="bg-[#202B43] text-[#F2F5FC]"><tr><th scope="col" className="p-2">Group</th><th scope="col" className="p-2">Range or category</th><th scope="col" className="p-2">Rows</th></tr></thead>
        <tbody>{bars.map((bar,index) => <tr key={index} className="border-t border-white/10">
          <th scope="row" className="p-2">{index+1}</th><td className="p-2 break-words">{bar.label}</td><td className="p-2 tabular-nums">{bar.count}</td>
        </tr>)}
        {!bars.length && <tr><td colSpan={3} className="p-3">No values recorded</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

export default function DataScienceWorkbench({ dataset, name }) {
  const [tab, setTab] = useState('overview');
  const [selectedColumn, setSelectedColumn] = useState(dataset?.headers?.[0] ?? '');
  const report = useMemo(() => dataset ? profileDataset(dataset) : null, [dataset]);
  if (!report) return <div className="rounded-xl border border-dashed border-white/20 p-5 text-sm text-[#9EACC4]" role="status">
    Import a CSV using the form above, or select <strong className="text-white">Try sample dataset</strong> to explore statistical evidence. Processing stays entirely in this browser.
  </div>;

  const active = report.columns.find(column=>column.name===selectedColumn) ?? report.columns[0];
  const tabs = [{id:'overview',name:'Overview'}, {id:'distributions',name:'Distributions'}, {id:'relationships',name:'Relationships'}, {id:'balance',name:'Class balance'}, {id:'outliers',name:'Outliers & quality'}, {id:'correlations',name:'Correlations'}, {id:'preview',name:'Row preview'}];
  return <section role="region" aria-label="Dataset profile dashboard" className="space-y-4 rounded-xl border border-white/10 bg-[#0D1422] p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h4 className="text-lg font-semibold text-white">Exploratory data analysis</h4>
        <p className="text-xs text-[#9EACC4]">Source: {name || 'Imported CSV'} · Exploratory statistics only; not fitted model parameters.</p>
      </div>
      <span className="rounded-full border border-emerald-400/25 px-3 py-1 text-xs text-emerald-200">Local-only analysis</span>
    </div>
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Metric label="Rows" value={report.rowCount} />
      <Metric label="Columns" value={report.columnCount} />
      <Metric label="Missing cells" value={report.missingCells} />
      <Metric label="Duplicate rows" value={report.duplicateRows} />
    </dl>
    <div role="group" aria-label="Workbench views" className="flex flex-wrap gap-2">
      {tabs.map(item => <button key={item.id} type="button" aria-pressed={tab===item.id} onClick={()=>setTab(item.id)}
        className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${tab===item.id ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 bg-[#151E30] text-[#9EACC4] hover:text-white'}`}>
        {item.name}
      </button>)}
    </div>
    {tab==='overview' && <div className="space-y-3">
      <p className="text-xs text-[#9EACC4]">Numeric summaries use only observed finite values. Missingness counts exclude empty, null and NaN fields.</p>
      <div role="region" aria-label="Column quality profile" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[680px] text-left text-xs">
          <caption className="p-3 text-left font-semibold text-white">Column summary and missingness</caption>
          <thead className="bg-[#202B43]"><tr>{['Column','Inferred type','Observed','Missing','Distinct','Mean','Median','Min','Max'].map(h=><th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
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
          className="mt-2 block min-h-11 w-full max-w-sm rounded-lg border border-white/20 bg-[#151E30] p-2 text-sm text-white">
          {report.columns.map(col=><option key={col.name} value={col.name}>{col.name} · {col.type}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-3 text-xs text-[#9EACC4]">
        <span>Observed: {active.present}</span><span>Missing: {active.missing}</span><span>Unique: {active.unique}</span>
        {active.type==='numeric' && <><span>Q1: {format(active.q1)}</span><span>Q3: {format(active.q3)}</span><span>Sample SD: {format(active.standardDeviation)}</span></>}
      </div>
      <Distribution column={active}/>
    </div>}
    {['relationships','balance','outliers'].includes(tab) && <DatasetInvestigation dataset={dataset} report={report} mode={tab} />}
    {tab==='correlations' && <div className="space-y-3">
      <p className="text-sm text-[#9EACC4]">Pairwise-complete Pearson correlation, not causation. Each cell uses only rows where both numeric features were measured. Constant columns and fewer than 3 valid pairs are marked unavailable.</p>
      {report.numericNames.length<2
        ? <p role="status" className="rounded-xl bg-[#151E30] p-4 text-sm">At least two numeric columns are required for a correlation matrix.</p>
        : <>
          {report.columns.filter(col=>col.type==='numeric').length>8 && <p className="text-xs text-amber-200">Showing the first eight numeric columns to keep the matrix readable.</p>}
          <div role="region" aria-label="Correlation matrix" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[500px] border-collapse text-center text-xs">
              <caption className="p-3 text-left text-[#9EACC4]">Pairwise Pearson coefficients (r). Each cell includes its paired sample count.</caption>
              <thead className="bg-[#202B43]"><tr><th scope="col" className="p-3">Feature</th>{report.numericNames.map(name=><th key={name} scope="col" className="p-3 break-words">{name}</th>)}</tr></thead>
              <tbody>{report.numericNames.map((name,rowIndex)=><tr key={name} className="border-t border-white/10">
                <th scope="row" className="p-3 text-left">{name}</th>
                {report.correlations[rowIndex].map((cell,colIndex)=><td key={report.numericNames[colIndex]} className="p-3 tabular-nums"
                  style={cell.r===null ? undefined : {backgroundColor:cell.r>=0?`rgba(70,215,242,${Math.abs(cell.r)*.23})`:`rgba(167,139,250,${Math.abs(cell.r)*.23})`}}>
                  <span className="block font-semibold">{cell.r===null?'N/A':cell.r.toFixed(3)}</span>
                  <span className="text-[10px] text-[#9EACC4]">n={cell.count}</span>
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </>}
    </div>}
    {tab==='preview' && <div role="region" aria-label="Uploaded row preview" tabIndex={0} className="max-w-full overflow-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[500px] text-left text-xs">
        <caption className="p-3 text-left text-[#9EACC4]">First {Math.min(12,report.rowCount)} of {report.rowCount} rows. Original values only; no imputation or scaling applied.</caption>
        <thead className="bg-[#202B43]"><tr>{dataset.headers.map(header=><th key={header} scope="col" className="p-2">{header}</th>)}</tr></thead>
        <tbody>{dataset.rows.slice(0,12).map((row,index)=><tr key={row.id??index} className="border-t border-white/10">
          {dataset.headers.map(header=><td key={header} className="p-2">{row[header] === null || row[header] === undefined ? <span className="text-amber-200">Missing</span> : String(row[header])}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
