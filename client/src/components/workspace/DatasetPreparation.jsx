import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAndValidateCSV } from '../../ml/datasetImport.js';
import { buildDatasetPipeline, defaultPipelineColumns, SPLIT_PRESETS } from '../../ml/pipelinePlanner.js';
import { validateExecutionBudget } from '../../services/productionConfig.js';
import { digest } from '../../../../shared/domain.mjs';
import { useLabStore } from '../../store/useLabStore.js';

const display = value => Number.isFinite(value) ? Number(value.toFixed(4)).toLocaleString() : 'Missing';

export default function DatasetPreparation({ initialData = null, onParsed }) {
  const [data, setData] = useState(initialData);
  const [columns, setColumns] = useState(() => defaultPipelineColumns(initialData));
  const [imputation, setImputation] = useState('mean');
  const [scaling, setScaling] = useState('standardize');
  const [splitPreset, setSplitPreset] = useState('70/15/15');
  const [seed, setSeed] = useState(42);
  const [error, setError] = useState('');
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
          preprocessing: 'pipeline:' + await digest(serialized),
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

  return <section aria-label="CSV preparation" className="space-y-4 rounded-xl border border-white/10 bg-obsidian/50 p-3 sm:p-4">
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-white">Visual preparation pipeline</h3>
      <p className="text-xs leading-relaxed text-text-muted">
        Import a CSV up to 2 MB and 2,000 rows, choose two numeric features and a 0/1 target, then inspect
        the real split and train-fitted transformations before launching either lab.
        Validation and test rows never contribute to imputer or scaler parameters.
      </p>
    </div>
    <label className="block max-w-xl text-sm font-medium text-white">
      Upload CSV dataset
      <input aria-label="CSV file" type="file" accept=".csv,text/csv"
        className="mt-2 block w-full max-w-xl rounded-lg border border-white/20 bg-surface-dark px-3 py-3 text-xs"
        onChange={async event => {
          try {
            const file = event.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) throw new Error('CSV must be at most 2 MB.');
            const parsed = parseAndValidateCSV(await file.text(), {requiredNumericCols: 0});
            setData(parsed);
            setColumns(defaultPipelineColumns(parsed));
            onParsed?.(parsed, file.name);
            setError('');
          } catch (reason) { setError(reason.message); }
        }} />
    </label>

    {data && <>
      <p className="text-sm text-text-muted">{data.rowCount} source rows · {data.headers.length} original columns · All data remains local</p>
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
    </>}
    {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
  </section>;
}
