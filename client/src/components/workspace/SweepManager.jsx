import { useState, useMemo } from 'react';
import { 
  Play, 
  GitBranch, 
  AlertTriangle 
} from 'lucide-react';
import { 
  generateGridManifest, 
  aggregateRepeatedTrials, 
  diffHyperparameters, 
  rankSweepResults 
} from '../../ml/sweeps.js';

export default function SweepManager({
  baseConfig = { learningRate: 0.01, batchSize: 32, epochs: 20 },
  existingRuns = [],
  onRun,
  running = false,
  className = ''
}) {
  const [learningRates, setLearningRates] = useState('0.001, 0.01, 0.05');
  const [batchSizes, setBatchSizes] = useState('16, 32');
  const [seedList, setSeedList] = useState('42, 101, 202');
  const [activeTab, setActiveTab] = useState('setup'); // 'setup', 'trials', 'diff'
  const [baselineConfig] = useState(baseConfig);
  const [selectedConfig, setSelectedConfig] = useState(null);

  // Parse grid options
  const parsedGrid = useMemo(() => {
    const lrs = learningRates.split(',').map(s => parseFloat(s.trim())).filter(n => !Number.isNaN(n));
    const bss = batchSizes.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n));
    return {
      learningRate: lrs.length > 0 ? lrs : [0.01],
      batchSize: bss.length > 0 ? bss : [32],
    };
  }, [learningRates, batchSizes]);

  const parsedSeeds = useMemo(() => {
    return seedList.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n));
  }, [seedList]);

  // Compute manifest and check budget
  const manifestState = useMemo(() => {
    try {
      const manifest = generateGridManifest(parsedGrid, {
        seeds: parsedSeeds.length > 0 ? parsedSeeds : [42],
        maxTotalJobs: 50,
        baseConfig,
      });
      return { manifest, error: null };
    } catch (err) {
      return { manifest: null, error: err.message };
    }
  }, [parsedGrid, parsedSeeds, baseConfig]);

  // Repeated trials aggregation
  const aggregated = useMemo(() => {
    const agg = aggregateRepeatedTrials(existingRuns, 'valLoss');
    return rankSweepResults(agg, 'valLoss', 'asc');
  }, [existingRuns]);

  // Parameter diff
  const paramDiff = useMemo(() => {
    if (!selectedConfig) return null;
    return diffHyperparameters(baselineConfig, selectedConfig);
  }, [baselineConfig, selectedConfig]);

  return (
    <div className={`rounded-xl bg-[#151E30] border border-white/10 p-4 text-xs font-mono shadow-xl flex flex-col space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#F3B65E]" />
          <span className="font-semibold text-white tracking-wide">Sweeps & Repeated Trials</span>
        </div>
        <div className="flex gap-1 bg-[#0A0F1D] p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'setup' ? 'bg-[#F3B65E] text-black font-semibold' : 'text-[#9EACC4] hover:text-white'
            }`}
          >
            Grid Setup
          </button>
          <button
            onClick={() => setActiveTab('trials')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'trials' ? 'bg-[#F3B65E] text-black font-semibold' : 'text-[#9EACC4] hover:text-white'
            }`}
          >
            Trial Aggregates ({aggregated.length})
          </button>
          {selectedConfig && (
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'diff' ? 'bg-[#F3B65E] text-black font-semibold' : 'text-[#9EACC4] hover:text-white'
              }`}
            >
              Config Diff
            </button>
          )}
        </div>
      </div>

      {/* Tab: Setup */}
      {activeTab === 'setup' && (
        <div className="space-y-4">
          <div className="space-y-3 bg-[#0A0F1D] p-3 rounded-lg border border-white/5">
            <div className="text-[11px] font-semibold text-white">Bounded Grid Specification</div>

            <div>
              <label className="text-[10px] text-[#9EACC4] block mb-1">
                Learning Rates (comma separated):
              </label>
              <input
                type="text"
                aria-label="Sweep learning rates"
                value={learningRates}
                onChange={e => setLearningRates(e.target.value)}
                className="w-full bg-[#151E30] border border-white/10 rounded px-2.5 py-1 text-white text-[11px] focus:outline-none focus:border-[#F3B65E]"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#9EACC4] block mb-1">
                Batch Sizes (comma separated):
              </label>
              <input
                type="text"
                aria-label="Sweep batch sizes"
                value={batchSizes}
                onChange={e => setBatchSizes(e.target.value)}
                className="w-full bg-[#151E30] border border-white/10 rounded px-2.5 py-1 text-white text-[11px] focus:outline-none focus:border-[#F3B65E]"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#9EACC4] block mb-1">
                Seed Repetitions (comma separated):
              </label>
              <input
                type="text"
                aria-label="Sweep seeds"
                value={seedList}
                onChange={e => setSeedList(e.target.value)}
                className="w-full bg-[#151E30] border border-white/10 rounded px-2.5 py-1 text-white text-[11px] focus:outline-none focus:border-[#F3B65E]"
              />
            </div>
          </div>

          {/* Budget Calculation & Status */}
          {manifestState.error ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{manifestState.error}</span>
            </div>
          ) : manifestState.manifest && (
            <div className="p-3 rounded-lg bg-[#0A0F1D] border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#9EACC4]">Total Configurations:</span>
                <span className="text-white font-bold">{manifestState.manifest.totalConfigs}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[#9EACC4]">Seeds per Config:</span>
                <span className="text-white font-bold">{manifestState.manifest.seedsPerConfig}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
                <span className="text-[#9EACC4]">Total Scheduled Jobs:</span>
                <span className="text-[#F3B65E] font-bold">
                  {manifestState.manifest.totalJobs} / {manifestState.manifest.maxTotalJobs} allowed
                </span>
              </div>

              <button
                disabled={manifestState.manifest.totalJobs === 0 || !onRun || running}
                onClick={() => onRun(manifestState.manifest)}
                className="w-full mt-2 py-2 bg-[#F3B65E] hover:bg-[#e0a44f] text-black font-semibold rounded text-[11px] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Run Sweep ({manifestState.manifest.totalJobs} Jobs)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Trial Aggregates */}
      {activeTab === 'trials' && (
        <div className="space-y-3">
          {aggregated.length === 0 ? (
            <div className="p-6 text-center text-[#9EACC4] bg-[#0A0F1D] rounded-lg border border-white/5">
              No repeated trial runs recorded yet. Run multiple experiments with identical hyperparameters to aggregate variance across seeds.
            </div>
          ) : (
            <div className="space-y-2">
              {aggregated.map(agg => (
                <div
                  key={agg.signature}
                  onClick={() => {
                    setSelectedConfig(agg.config);
                    setActiveTab('diff');
                  }}
                  className="p-3 rounded-lg bg-[#0A0F1D] border border-white/5 hover:border-white/20 cursor-pointer transition-colors space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white text-[11px]">
                      Rank #{agg.rank} &middot; Val Loss: {agg.mean !== null ? agg.mean.toFixed(4) : 'N/A'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-[#F3B65E]">
                      {agg.trialCount} {agg.trialCount === 1 ? 'trial' : 'trials'}
                    </span>
                  </div>

                  {/* Dispersion info */}
                  <div className="text-[10px] text-[#9EACC4] flex justify-between">
                    <span>Std Dev: {agg.std !== null ? agg.std.toFixed(4) : 'N/A'}</span>
                    <span>Min: {agg.min !== null ? agg.min.toFixed(4) : 'N/A'} | Max: {agg.max !== null ? agg.max.toFixed(4) : 'N/A'}</span>
                  </div>

                  {/* Small trial caution badge */}
                  {agg.smallTrialCaution && (
                    <div className="text-[9px] text-amber-400 flex items-center gap-1 pt-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      Small trial cohort (&lt; 5 seeds). Dispersion should be interpreted cautiously.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Parameter Diff */}
      {activeTab === 'diff' && paramDiff && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-[#0A0F1D] border border-white/5 space-y-2">
            <div className="font-semibold text-white text-[11px] flex justify-between">
              <span>Hyperparameter Differences</span>
              <span className="text-[#9EACC4] text-[10px]">{paramDiff.differenceCount} differences</span>
            </div>

            {paramDiff.differenceCount === 0 ? (
              <div className="text-[#9EACC4] text-[10px]">Identical configuration to baseline.</div>
            ) : (
              <div className="space-y-1.5 pt-1">
                {paramDiff.diffs.map(d => (
                  <div key={d.parameter} className="p-2 rounded bg-white/5 text-[10px] flex justify-between items-center">
                    <span className="text-white font-mono">{d.parameter}:</span>
                    <span className="text-[#9EACC4]">
                      <span className="text-red-400 line-through mr-1.5">{JSON.stringify(d.valueA)}</span>
                      &rarr;
                      <span className="text-[#3CD5AA] font-bold ml-1.5">{JSON.stringify(d.valueB)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
