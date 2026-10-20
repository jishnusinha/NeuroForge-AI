import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  Copy, 
  Check, 
  Download,
} from 'lucide-react';
import { fetchExperimentById } from '../services/api';
import { useLabStore } from '../store/useLabStore';

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast, loadRun, setExperimentName } = useLabStore();
  const [experiment, setExperiment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchExperimentById(id);
      setExperiment(data);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleCopyConfig = () => {
    if (!experiment) return;
    const configStr = JSON.stringify(
      {
        experiment: experiment.name,
        algorithm: experiment.algorithm,
        dataset: experiment.dataset,
        hyperparameters: experiment.hyperparameters,
        metrics: experiment.metrics,
      },
      null,
      2
    );
    navigator.clipboard?.writeText(configStr);
    setCopied(true);
    showToast('Reproducible JSON configuration copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    if (!experiment) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(experiment, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${experiment.name.toLowerCase().replace(/\s+/g, '_')}_report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported experiment report as JSON.', 'success');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-sm font-mono text-plasma-cyan">
          <span className="w-3 h-3 rounded-full bg-plasma-cyan animate-ping" />
          <span>Retrieving persistent experiment record...</span>
        </div>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <div className="p-4 rounded-full bg-white/5 border border-white/10 text-text-muted">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-display font-bold text-white">Experiment Report Not Found</h2>
        <p className="text-xs text-text-muted max-w-sm text-center">
          The requested experiment record is not found in the local database.
        </p>
        <Link
          to="/app/experiments"
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white"
        >
          Return to Experiments Library
        </Link>
      </div>
    );
  }

  const { metrics, hyperparameters, dataset, metricHistory } = experiment;

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header & Back Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Experiments</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              {experiment.name}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-quantum-mint/15 text-quantum-mint border border-quantum-mint/30">
              {experiment.status}
            </span>
          </div>
          <p className="text-xs text-text-muted font-mono mt-1">
            Share ID: <span className="text-plasma-cyan">{experiment.shareId}</span> • Recorded on {new Date(experiment.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {experiment.workspace && experiment.dataset?.points?.length > 0 && <button className="px-3 py-2 rounded bg-violet-400/20 text-violet-200 text-xs" onClick={() => {
            loadRun(structuredClone(experiment)); setExperimentName(`Fork of ${experiment.name}`);
            navigate(`/app/${experiment.workspace === 'studio' ? 'studio' : 'playground'}`);
          }}>Open & Improve</button>}
          <button
            onClick={handleCopyConfig}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-quantum-mint" /> : <Copy className="w-3.5 h-3.5 text-plasma-cyan" />}
            <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-plasma-cyan to-quantum-mint text-ink-on-accent text-xs font-semibold hover:opacity-95 shadow-glow-cyan transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Model & Dataset Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-obsidian border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-plasma-cyan font-semibold">Algorithm</span>
          <div className="mt-1 text-base font-semibold text-white">{experiment.algorithm}</div>
          <p className="text-xs text-text-muted font-mono mt-1">
            Engine: {experiment.runtime?.tensorflow ? `TensorFlow.js ${experiment.runtime.tensorflow} (${experiment.runtime.backend})` : 'Browser JavaScript'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-obsidian border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-neural-violet font-semibold">Dataset Provenance</span>
          <div className="mt-1 text-base font-semibold text-white">{dataset?.name || 'Synthetic'}</div>
          <p className="text-xs text-text-muted font-mono mt-1">
            N={dataset?.sampleCount ?? 'Unknown'} · Split: {((dataset?.trainRatio ?? 0.8) * 100).toFixed(0)}/{((1-(dataset?.trainRatio ?? .8))*100).toFixed(0)} · Seed: #{dataset?.seed ?? 'Unknown'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-obsidian border border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-wider text-quantum-mint font-semibold">Evaluation Status</span>
          <div className="mt-1 text-base font-semibold text-white">
            {Number.isFinite(metrics?.valAccuracy) ? `${(metrics.valAccuracy * 100).toFixed(1)}% Accuracy` :
             metrics?.r2 !== undefined ? `R² = ${metrics.r2}` :
             metrics?.inertia !== undefined ? `Inertia: ${metrics.inertia}` : 'Validated'}
          </div>
          <p className="text-xs text-text-muted font-mono mt-1">
            Train Loss: {metrics?.trainLoss ?? 'N/A'} • Val Loss: {metrics?.valLoss ?? 'N/A'}
          </p>
        </div>
      </div>

      {/* Training Trajectory Loss Curves */}
      {metricHistory && metricHistory.length > 0 && (
        <div className="p-6 rounded-2xl bg-obsidian border border-white/10 shadow-lg space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-white">Recorded Convergence Trajectory</h3>
              <p className="text-xs text-text-muted mt-0.5">Epoch by epoch training and validation loss progression.</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-plasma-cyan">
                <span className="w-2.5 h-0.5 bg-plasma-cyan" /> Training Loss
              </span>
            </div>
          </div>

          <div className="h-36 w-full flex items-end gap-2 pt-4 px-2 border-b border-l border-white/10">
            {metricHistory.map((m, idx) => (
              <div key={idx} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                <div
                  className="w-full bg-plasma-cyan/80 hover:bg-plasma-cyan rounded-t transition-all"
                  style={{ height: `${Math.min(100, Math.max(12, m.loss * 120))}%` }}
                />
                <span className="text-[9px] font-mono text-text-muted">{m.epoch}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-text-muted">
            <span>Start (Epoch 0)</span>
            <span>Recorded Epochs</span>
            <span>Final (Epoch {metricHistory[metricHistory.length - 1]?.epoch || 60})</span>
          </div>
        </div>
      )}

      {/* Hyperparameters & Scientific Reproducibility Box */}
      <div className="p-6 rounded-2xl bg-obsidian border border-white/10 space-y-4">
        <h3 className="text-sm font-semibold text-white">Reproducibility Specifications</h3>
        <div className="p-4 rounded-xl bg-deep-space border border-white/5 font-mono text-xs text-text-muted overflow-x-auto">
          <pre>{JSON.stringify({ dataset, hyperparameters, metrics }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
