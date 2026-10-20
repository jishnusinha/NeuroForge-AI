import React, { useState, useEffect } from 'react';
import { Square, CheckCircle2, AlertCircle, RefreshCw, ChevronUp, ChevronDown, Cpu } from 'lucide-react';
import { modelRunner } from '../../ml/modelRunner';


export default function ActivityDrawer() {
  const [jobState, setJobState] = useState({
    status: 'idle',
    epoch: 0,
    totalEpochs: 60,
    loss: null,
    valLoss: null,
    accuracy: null,
    valAccuracy: null,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [tensorStats, setTensorStats] = useState(modelRunner.getStatus());

  useEffect(() => {
    const unsubscribe = modelRunner.subscribe((event) => {
      setJobState((prev) => ({ ...prev, ...event }));
      setTensorStats(modelRunner.getStatus());
    });
    return () => unsubscribe();
  }, []);

  // Update tensor count periodically if running
  useEffect(() => {
    if (jobState.status === 'running') {
      const interval = setInterval(() => {
        setTensorStats(modelRunner.getStatus());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [jobState.status]);

  if (jobState.status === 'idle') return null;

  const progressPercent = jobState.totalEpochs > 0 
    ? Math.min(100, Math.round((jobState.epoch / jobState.totalEpochs) * 100)) 
    : 0;

  return (
    <aside 
      className="fixed bottom-4 right-4 z-40 w-80 bg-surface-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs transition-all animate-slideUp"
      role="region"
      aria-label="Training Activity Drawer"
    >
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-obsidian flex items-center justify-between cursor-pointer border-b border-white/5 select-none hover:bg-surface-inset"
      >
        <div className="flex items-center gap-2">
          {jobState.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-plasma-cyan animate-spin" />}
          {jobState.status === 'stopping' && <RefreshCw className="w-3.5 h-3.5 text-signal-amber animate-spin" />}
          {jobState.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-quantum-mint" />}
          {jobState.status === 'cancelled' && <Square className="w-3.5 h-3.5 text-signal-amber" />}
          {jobState.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-alert-pink" />}

          <span className="font-semibold text-white capitalize">
            {jobState.status === 'running' ? `Training: ${progressPercent}%` : `Job ${jobState.status}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {jobState.status === 'running' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                modelRunner.stop();
              }}
              className="px-2 py-0.5 rounded bg-alert-pink/20 hover:bg-alert-pink/30 text-alert-pink text-[10px] font-bold border border-alert-pink/30 transition-colors"
            >
              Stop
            </button>
          )}
          <button type="button" className="text-text-muted hover:text-white">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar line */}
      <div className="w-full bg-deep-space h-1">
        <div 
          className="bg-gradient-to-r from-plasma-cyan to-quantum-mint h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-surface-dark text-[11px]">
          <div className="flex justify-between items-center py-0.5 text-text-muted">
            <span>Epoch:</span>
            <span className="text-white font-semibold">{jobState.epoch} / {jobState.totalEpochs}</span>
          </div>

          <div className="flex justify-between items-center py-0.5 text-text-muted">
            <span>Loss (BCE):</span>
            <span className="text-plasma-cyan font-semibold">
              {jobState.loss !== null ? jobState.loss.toFixed(4) : '—'}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5 text-text-muted">
            <span>Val Accuracy:</span>
            <span className="text-quantum-mint font-semibold">
              {jobState.valAccuracy !== null ? `${(jobState.valAccuracy * 100).toFixed(1)}%` : '—'}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-text-muted/70">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-neural-violet" />
              Backend: {tensorStats.backend}
            </span>
            <span>Tensors: {tensorStats.tensorsCount}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
