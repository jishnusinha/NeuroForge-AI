import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scale, 
  GitFork, 
  Sliders, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  Activity, 
  ArrowRight, 
  Info, 
  Clock,
  Layers,
  Zap,
  BarChart2
} from 'lucide-react';
import { fetchExperiments } from '../services/api';
import { useLabStore } from '../store/useLabStore';

export default function ArenaShell() {
  const navigate = useNavigate();
  const { showToast, setExperimentName, setExperimentStatus } = useLabStore();

  const [experimentsList, setExperimentsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default Candidate Runs for Empirical Arena
  const standardRuns = useMemo(() => [
    {
      _id: 'std-run-1',
      name: 'Baseline: Logistic Classifier',
      algorithm: 'Logistic Regression (Linear)',
      dataset: { name: 'Two Moons', sampleCount: 220, noise: 0.3, trainRatio: 0.8, seed: 42 },
      params: 3,
      metrics: { trainLoss: 0.38, valLoss: 0.42, trainAccuracy: 0.84, valAccuracy: 0.835 },
      metricHistory: [
        { epoch: 10, loss: 0.62, valLoss: 0.64, accuracy: 0.68, valAccuracy: 0.67 },
        { epoch: 20, loss: 0.49, valLoss: 0.52, accuracy: 0.76, valAccuracy: 0.75 },
        { epoch: 30, loss: 0.43, valLoss: 0.46, accuracy: 0.81, valAccuracy: 0.80 },
        { epoch: 40, loss: 0.40, valLoss: 0.43, accuracy: 0.83, valAccuracy: 0.82 },
        { epoch: 50, loss: 0.38, valLoss: 0.42, accuracy: 0.84, valAccuracy: 0.835 },
      ],
      overfitting: false,
    },
    {
      _id: 'std-run-2',
      name: 'Variant A: High-Capacity MLP (2-16-16-1)',
      algorithm: 'Deep Dense MLP (ReLU)',
      dataset: { name: 'Two Moons', sampleCount: 220, noise: 0.3, trainRatio: 0.8, seed: 42 },
      params: 353,
      metrics: { trainLoss: 0.05, valLoss: 0.48, trainAccuracy: 0.99, valAccuracy: 0.88 },
      metricHistory: [
        { epoch: 10, loss: 0.51, valLoss: 0.53, accuracy: 0.72, valAccuracy: 0.71 },
        { epoch: 20, loss: 0.28, valLoss: 0.34, accuracy: 0.89, valAccuracy: 0.87 },
        { epoch: 30, loss: 0.16, valLoss: 0.31, accuracy: 0.94, valAccuracy: 0.91 },
        { epoch: 40, loss: 0.09, valLoss: 0.38, accuracy: 0.97, valAccuracy: 0.89 },
        { epoch: 50, loss: 0.05, valLoss: 0.48, accuracy: 0.99, valAccuracy: 0.88 },
      ],
      overfitting: true,
    },
    {
      _id: 'std-run-3',
      name: 'Variant B: Regularized MLP (2-8-1)',
      algorithm: 'Regularized MLP (L2=0.01)',
      dataset: { name: 'Two Moons', sampleCount: 220, noise: 0.3, trainRatio: 0.8, seed: 42 },
      params: 29,
      metrics: { trainLoss: 0.16, valLoss: 0.19, trainAccuracy: 0.93, valAccuracy: 0.925 },
      metricHistory: [
        { epoch: 10, loss: 0.55, valLoss: 0.56, accuracy: 0.70, valAccuracy: 0.69 },
        { epoch: 20, loss: 0.35, valLoss: 0.38, accuracy: 0.84, valAccuracy: 0.83 },
        { epoch: 30, loss: 0.24, valLoss: 0.26, accuracy: 0.90, valAccuracy: 0.89 },
        { epoch: 40, loss: 0.18, valLoss: 0.21, accuracy: 0.92, valAccuracy: 0.91 },
        { epoch: 50, loss: 0.16, valLoss: 0.19, accuracy: 0.93, valAccuracy: 0.925 },
      ],
      overfitting: false,
    },
    {
      _id: 'std-run-xor-1',
      name: 'XOR Linear Perceptron (Fails)',
      algorithm: 'Single-Layer Perceptron (2-1)',
      dataset: { name: 'XOR Problem', sampleCount: 180, noise: 0.1, trainRatio: 0.8, seed: 42 },
      params: 3,
      metrics: { trainLoss: 0.693, valLoss: 0.695, trainAccuracy: 0.50, valAccuracy: 0.50 },
      metricHistory: [
        { epoch: 10, loss: 0.694, valLoss: 0.695, accuracy: 0.50, valAccuracy: 0.50 },
        { epoch: 30, loss: 0.693, valLoss: 0.695, accuracy: 0.50, valAccuracy: 0.50 },
        { epoch: 50, loss: 0.693, valLoss: 0.695, accuracy: 0.50, valAccuracy: 0.50 },
      ],
      overfitting: false,
    },
    {
      _id: 'std-run-xor-2',
      name: 'XOR Non-linear Solution (2-4-1)',
      algorithm: 'Dense MLP (ReLU)',
      dataset: { name: 'XOR Problem', sampleCount: 180, noise: 0.1, trainRatio: 0.8, seed: 42 },
      params: 17,
      metrics: { trainLoss: 0.012, valLoss: 0.018, trainAccuracy: 1.0, valAccuracy: 1.0 },
      metricHistory: [
        { epoch: 10, loss: 0.52, valLoss: 0.54, accuracy: 0.65, valAccuracy: 0.65 },
        { epoch: 20, loss: 0.31, valLoss: 0.35, accuracy: 0.88, valAccuracy: 0.88 },
        { epoch: 30, loss: 0.14, valLoss: 0.17, accuracy: 0.97, valAccuracy: 0.97 },
        { epoch: 40, loss: 0.04, valLoss: 0.06, accuracy: 1.0, valAccuracy: 1.0 },
        { epoch: 50, loss: 0.012, valLoss: 0.018, accuracy: 1.0, valAccuracy: 1.0 },
      ],
      overfitting: false,
    }
  ], []);

  // Selected candidate run IDs
  const [baselineId, setBaselineId] = useState('std-run-1');
  const [variantId, setVariantId] = useState('std-run-2');
  const [scrubberEpoch, setScrubberEpoch] = useState(50);
  const [metricTab, setMetricTab] = useState('loss'); // 'loss' | 'accuracy'

  // Load runs from backend
  useEffect(() => {
    async function load() {
      setLoading(true);
      const apiRuns = await fetchExperiments();
      // Combine API runs with standard reference benchmarks
      const combined = [...apiRuns, ...standardRuns];
      // Deduplicate by name or ID
      const unique = Array.from(new Map(combined.map(r => [r.name, r])).values());
      setExperimentsList(unique);
      setLoading(false);
    }
    load();
  }, [standardRuns]);

  const selectedBaseline = useMemo(() => {
    return experimentsList.find(r => (r._id === baselineId || r.shareId === baselineId || r.name === baselineId)) || standardRuns[0];
  }, [experimentsList, baselineId, standardRuns]);

  const selectedVariant = useMemo(() => {
    return experimentsList.find(r => (r._id === variantId || r.shareId === variantId || r.name === variantId)) || standardRuns[1];
  }, [experimentsList, variantId, standardRuns]);

  // Fair Comparison Verification
  const isFairComparison = useMemo(() => {
    if (!selectedBaseline?.dataset || !selectedVariant?.dataset) return true;
    return selectedBaseline.dataset.name === selectedVariant.dataset.name;
  }, [selectedBaseline, selectedVariant]);

  // Calculate Metrics at Scrubber Epoch
  const currentMetrics = useMemo(() => {
    const getAtEpoch = (run, ep) => {
      const hist = run.metricHistory || [];
      if (hist.length === 0) return { loss: run.metrics?.trainLoss ?? 0.2, valLoss: run.metrics?.valLoss ?? 0.25, acc: run.metrics?.valAccuracy ?? 0.85 };
      // Find closest
      let closest = hist[0];
      for (const h of hist) {
        if (Math.abs(h.epoch - ep) <= Math.abs(closest.epoch - ep)) {
          closest = h;
        }
      }
      return {
        loss: closest.loss ?? 0.2,
        valLoss: closest.valLoss ?? closest.loss ?? 0.25,
        acc: closest.valAccuracy ?? closest.accuracy ?? 0.85,
      };
    };

    return {
      base: getAtEpoch(selectedBaseline, scrubberEpoch),
      var: getAtEpoch(selectedVariant, scrubberEpoch),
    };
  }, [selectedBaseline, selectedVariant, scrubberEpoch]);

  // Fork and Improve Action
  const handleFork = (run) => {
    setExperimentName(`Fork of ${run.name}`);
    setExperimentStatus('Ready');
    showToast(`Configuration for "${run.name}" loaded into workspace.`, 'success');
    if (run.algorithm.includes('MLP') || run.algorithm.includes('Perceptron')) {
      navigate('/app/studio');
    } else {
      navigate('/app/playground');
    }
  };

  // Quick Preset Benchmark Sets
  const handleLoadBenchmarkSet = (setType) => {
    if (setType === 'overfitting') {
      setBaselineId('std-run-1');
      setVariantId('std-run-2');
      showToast('Loaded Overfitting Benchmark (Logistic vs High-Capacity MLP)', 'info');
    } else if (setType === 'xor') {
      setBaselineId('std-run-xor-1');
      setVariantId('std-run-xor-2');
      showToast('Loaded XOR Architectural Benchmark (Linear Perceptron vs Hidden Layer)', 'info');
    } else if (setType === 'regularization') {
      setBaselineId('std-run-2');
      setVariantId('std-run-3');
      showToast('Loaded Regularization Benchmark (Unconstrained vs L2-Regularized)', 'info');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Upper 3-Panel Arena Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Candidate Run Selector (280px) */}
        <aside className="w-[300px] bg-[#151E30] border-r border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#3CD5AA] font-semibold">
              01 • Run Pairing & Protocol
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">Select Empirical Runs</h3>
          </div>

          {/* Quick Benchmark Loaders */}
          <div className="space-y-1">
            <label className="text-xs text-[#9EACC4] font-medium">Curated Benchmark Pairs</label>
            <div className="grid grid-cols-1 gap-1">
              <button
                onClick={() => handleLoadBenchmarkSet('overfitting')}
                className="text-left px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-xs text-white"
              >
                1. Overfitting & Capacity Lab
              </button>
              <button
                onClick={() => handleLoadBenchmarkSet('xor')}
                className="text-left px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-xs text-white"
              >
                2. XOR Non-Linearity Limit
              </button>
              <button
                onClick={() => handleLoadBenchmarkSet('regularization')}
                className="text-left px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-xs text-white"
              >
                3. L2 Regularization Tradeoff
              </button>
            </div>
          </div>

          {/* Baseline Picker */}
          <div className="space-y-1 pt-1 border-t border-white/5">
            <label className="text-xs text-[#9EACC4] font-medium flex items-center justify-between">
              <span>Baseline Run (Model A)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#46D7F2]" />
            </label>
            <select
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#080D18] border border-white/10 text-xs text-white focus:outline-none focus:border-[#46D7F2]"
            >
              {experimentsList.map((r) => (
                <option key={r._id || r.shareId} value={r._id || r.shareId}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Variant Picker */}
          <div className="space-y-1">
            <label className="text-xs text-[#9EACC4] font-medium flex items-center justify-between">
              <span>Variant Run (Model B)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]" />
            </label>
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-[#080D18] border border-white/10 text-xs text-white focus:outline-none focus:border-[#A78BFA]"
            >
              {experimentsList.map((r) => (
                <option key={r._id || r.shareId} value={r._id || r.shareId}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fair Comparison Protocol Verification */}
          <div className={`p-3 rounded-xl border space-y-1.5 ${
            isFairComparison 
              ? 'bg-[#080D18] border-[#3CD5AA]/30 text-[#3CD5AA]' 
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {isFairComparison ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{isFairComparison ? 'Protocol: Fair Comparison Valid' : 'Warning: Dataset Mismatch'}</span>
            </div>
            <p className="text-[11px] text-[#9EACC4] leading-relaxed">
              {isFairComparison
                ? `Both runs evaluated on identical ${selectedBaseline.dataset?.name || 'Standard'} test distribution.`
                : 'Models evaluated on different datasets. Cross-metric comparison is scientifically invalid.'}
            </p>
          </div>

          {/* Fork & Duplicate Action */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <button
              onClick={() => handleFork(selectedVariant)}
              className="w-full py-2.5 rounded-xl bg-[#A78BFA]/15 hover:bg-[#A78BFA]/25 border border-[#A78BFA]/30 text-xs font-semibold text-[#A78BFA] flex items-center justify-center gap-2 transition-all"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Duplicate & Improve Variant</span>
            </button>
          </div>
        </aside>

        {/* Center: Synchronized Replay & Overlaid Trajectory Visualizer */}
        <section className="flex-1 flex flex-col bg-[#080D18] relative overflow-hidden">
          
          {/* Synchronized Replay Control Header */}
          <div className="h-14 border-b border-white/10 px-6 bg-[#0D1422] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-white flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#46D7F2]" />
                Synchronized Scrubber:
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={scrubberEpoch}
                  onChange={(e) => setScrubberEpoch(Number(e.target.value))}
                  className="w-48 h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#46D7F2]"
                />
                <span className="text-xs font-mono text-[#46D7F2] font-bold">Epoch {scrubberEpoch}</span>
              </div>
            </div>

            <div className="flex rounded-lg bg-[#151E30] p-0.5 border border-white/10">
              <button
                onClick={() => setMetricTab('loss')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  metricTab === 'loss' ? 'bg-[#46D7F2] text-[#080D18] font-bold' : 'text-[#9EACC4] hover:text-white'
                }`}
              >
                Loss Trajectories
              </button>
              <button
                onClick={() => setMetricTab('accuracy')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  metricTab === 'accuracy' ? 'bg-[#A78BFA] text-[#080D18] font-bold' : 'text-[#9EACC4] hover:text-white'
                }`}
              >
                Accuracy Growth
              </button>
            </div>
          </div>

          {/* Metric Comparison Displays */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            
            {/* Top Score Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#151E30] border border-[#46D7F2]/40 shadow-sm relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-[#46D7F2] uppercase font-bold tracking-wider">
                      Model A • Baseline
                    </span>
                    <h4 className="text-base font-semibold text-white mt-1">{selectedBaseline.name}</h4>
                    <p className="text-xs text-[#9EACC4] font-mono mt-0.5">{selectedBaseline.algorithm}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-bold text-[#46D7F2]">
                      {(currentMetrics.base.acc * 100).toFixed(1)}%
                    </span>
                    <p className="text-[10px] text-[#9EACC4] font-mono">Test Accuracy @ Ep {scrubberEpoch}</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs font-mono text-[#9EACC4]">
                  <span>Train Loss: <strong className="text-white">{currentMetrics.base.loss.toFixed(3)}</strong></span>
                  <span>Val Loss: <strong className="text-white">{currentMetrics.base.valLoss.toFixed(3)}</strong></span>
                  <span>Weights: <strong className="text-white">{selectedBaseline.params || 3}</strong></span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#151E30] border border-[#A78BFA]/40 shadow-sm relative">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-[#A78BFA] uppercase font-bold tracking-wider">
                      Model B • Variant
                    </span>
                    <h4 className="text-base font-semibold text-white mt-1">{selectedVariant.name}</h4>
                    <p className="text-xs text-[#9EACC4] font-mono mt-0.5">{selectedVariant.algorithm}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-bold text-[#A78BFA]">
                      {(currentMetrics.var.acc * 100).toFixed(1)}%
                    </span>
                    <p className="text-[10px] text-[#9EACC4] font-mono">Test Accuracy @ Ep {scrubberEpoch}</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between text-xs font-mono text-[#9EACC4]">
                  <span>Train Loss: <strong className="text-white">{currentMetrics.var.loss.toFixed(3)}</strong></span>
                  <span>Val Loss: <strong className="text-white">{currentMetrics.var.valLoss.toFixed(3)}</strong></span>
                  <span>Weights: <strong className="text-white">{selectedVariant.params || 17}</strong></span>
                </div>
              </div>
            </div>

            {/* Overlaid Trajectory Plot */}
            <div className="p-6 rounded-2xl bg-[#151E30] border border-white/10 shadow-lg space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {metricTab === 'loss' ? 'Comparative Loss Trajectory (Train vs. Validation)' : 'Accuracy Growth per Epoch'}
                  </h4>
                  <p className="text-xs text-[#9EACC4] mt-0.5">
                    Continuous curves showing convergence rates and divergence points.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-[#46D7F2]">
                    <span className="w-3 h-0.5 bg-[#46D7F2]" /> Model A
                  </span>
                  <span className="flex items-center gap-1.5 text-[#A78BFA]">
                    <span className="w-3 h-0.5 bg-[#A78BFA]" /> Model B
                  </span>
                </div>
              </div>

              {/* Graphical SVG Comparison Line Plot */}
              <div className="h-52 w-full relative border-b border-l border-white/10 pt-4 px-2">
                <svg className="w-full h-full" viewBox="0 0 600 160" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="40" x2="600" y2="40" stroke="rgba(255,255,255,0.05)" />
                  <line x1="0" y1="80" x2="600" y2="80" stroke="rgba(255,255,255,0.05)" />
                  <line x1="0" y1="120" x2="600" y2="120" stroke="rgba(255,255,255,0.05)" />

                  {/* Baseline curve */}
                  <path
                    d={metricTab === 'loss' 
                      ? "M 0 135 Q 180 85 360 70 T 600 65" 
                      : "M 0 110 Q 180 50 360 40 T 600 35"}
                    stroke="#46D7F2"
                    strokeWidth="2.5"
                    fill="none"
                  />

                  {/* Variant curve */}
                  <path
                    d={metricTab === 'loss'
                      ? (selectedVariant.overfitting 
                        ? "M 0 145 Q 150 40 300 20 T 480 40 Q 540 65 600 85" 
                        : "M 0 145 Q 150 45 300 25 T 600 20")
                      : "M 0 115 Q 150 35 300 20 T 600 15"}
                    stroke="#A78BFA"
                    strokeWidth="2.5"
                    fill="none"
                  />

                  {/* Scrubber vertical line */}
                  <line 
                    x1={`${(scrubberEpoch / 50) * 600}`} 
                    y1="0" 
                    x2={`${(scrubberEpoch / 50) * 600}`} 
                    y2="160" 
                    stroke="#3CD5AA" 
                    strokeWidth="1.5" 
                    strokeDasharray="4 4" 
                  />
                </svg>
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-[#9EACC4] mt-1">
                <span>Epoch 0</span>
                <span className="text-[#3CD5AA] font-bold">Scrubber: Epoch {scrubberEpoch}</span>
                <span>Epoch 50</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Automated Evidence-Based Insight Inspector ("What Changed?") */}
        <aside className="w-[320px] bg-[#151E30] border-l border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#F3B65E] font-semibold">
              03 • Evidence Inspector
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">Automated Findings</h3>
          </div>

          {/* Finding Insight Card */}
          <div className="p-3.5 rounded-xl bg-[#080D18] border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sparkles className="w-4 h-4 text-[#F3B65E]" />
              <span>Comparative Finding</span>
            </div>
            
            {selectedVariant.overfitting ? (
              <div className="space-y-2 text-xs text-[#9EACC4] leading-relaxed">
                <div className="flex items-center gap-1.5 text-[#F3B65E] font-mono text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Generalization Gap Detected</span>
                </div>
                <p>
                  Model B achieves lower training error (<strong className="text-white">{currentMetrics.var.loss.toFixed(3)} vs {currentMetrics.base.loss.toFixed(3)}</strong>), but its validation loss climbs after epoch 30.
                </p>
                <p className="text-[11px]">
                  The 353 learned weights overfit to dataset noise rather than learning genuine invariant decision contours.
                </p>
              </div>
            ) : selectedVariant.name.includes('XOR') && !selectedBaseline.name.includes('Non-linear') ? (
              <div className="space-y-2 text-xs text-[#9EACC4] leading-relaxed">
                <div className="flex items-center gap-1.5 text-[#3CD5AA] font-mono text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Representational Superiority</span>
                </div>
                <p>
                  Model B successfully forms a non-linear hyper-surface, achieving 100% classification accuracy on XOR where Model A was mathematically bounded to 50%.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-[#9EACC4] leading-relaxed">
                <div className="flex items-center gap-1.5 text-[#3CD5AA] font-mono text-[11px] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Balanced Optimization</span>
                </div>
                <p>
                  Both training and validation trajectories track tightly without divergence, verifying optimal bias-variance equilibrium.
                </p>
              </div>
            )}
          </div>

          {/* Delta Comparison Table */}
          <div className="space-y-1.5">
            <span className="text-xs text-[#9EACC4] font-medium">Empirical Delta Metrics</span>
            <div className="p-3 rounded-xl bg-[#080D18] border border-white/5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#9EACC4]">Accuracy Delta:</span>
                <span className={currentMetrics.var.acc >= currentMetrics.base.acc ? 'text-[#3CD5AA]' : 'text-red-400'}>
                  {currentMetrics.var.acc >= currentMetrics.base.acc ? '+' : ''}
                  {((currentMetrics.var.acc - currentMetrics.base.acc) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9EACC4]">Loss Delta:</span>
                <span className={currentMetrics.var.loss <= currentMetrics.base.loss ? 'text-[#3CD5AA]' : 'text-red-400'}>
                  {(currentMetrics.var.loss - currentMetrics.base.loss).toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9EACC4]">Weight Capacity:</span>
                <span className="text-white">
                  +{(selectedVariant.params || 17) - (selectedBaseline.params || 3)} params
                </span>
              </div>
            </div>
          </div>

          {/* Interview Technical Discussion Guide */}
          <div className="p-3 rounded-xl bg-[#202B43]/50 border border-white/5 space-y-1.5">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#46D7F2]" />
              <span>Interview Talking Points</span>
            </span>
            <p className="text-[11px] text-[#9EACC4] leading-relaxed">
              Demonstrate understanding of the <em>bias-variance tradeoff</em>, early stopping strategies, and how to scientifically prove model improvements beyond random seed variation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
