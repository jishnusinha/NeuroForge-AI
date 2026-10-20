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
      className="fixed bottom-4 right-4 z-40 w-80 bg-[#0D1422] border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs transition-all animate-slideUp"
      role="region"
      aria-label="Training Activity Drawer"
    >
      {/* Header bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-[#151E30] flex items-center justify-between cursor-pointer border-b border-white/5 select-none hover:bg-[#1a253b]"
      >
        <div className="flex items-center gap-2">
          {jobState.status === 'running' && <RefreshCw className="w-3.5 h-3.5 text-[#46D7F2] animate-spin" />}
          {jobState.status === 'stopping' && <RefreshCw className="w-3.5 h-3.5 text-[#F3B65E] animate-spin" />}
          {jobState.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-[#3CD5AA]" />}
          {jobState.status === 'cancelled' && <Square className="w-3.5 h-3.5 text-[#F3B65E]" />}
          {jobState.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-[#FF5C8A]" />}

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
              className="px-2 py-0.5 rounded bg-[#FF5C8A]/20 hover:bg-[#FF5C8A]/30 text-[#FF5C8A] text-[10px] font-bold border border-[#FF5C8A]/30 transition-colors"
            >
              Stop
            </button>
          )}
          <button type="button" className="text-[#9EACC4] hover:text-white">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress bar line */}
      <div className="w-full bg-[#080D18] h-1">
        <div 
          className="bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="p-3 space-y-2 bg-[#0D1422] text-[11px]">
          <div className="flex justify-between items-center py-0.5 text-[#9EACC4]">
            <span>Epoch:</span>
            <span className="text-white font-semibold">{jobState.epoch} / {jobState.totalEpochs}</span>
          </div>

          <div className="flex justify-between items-center py-0.5 text-[#9EACC4]">
            <span>Loss (BCE):</span>
            <span className="text-[#46D7F2] font-semibold">
              {jobState.loss !== null ? jobState.loss.toFixed(4) : '—'}
            </span>
          </div>

          <div className="flex justify-between items-center py-0.5 text-[#9EACC4]">
            <span>Val Accuracy:</span>
            <span className="text-[#3CD5AA] font-semibold">
              {jobState.valAccuracy !== null ? `${(jobState.valAccuracy * 100).toFixed(1)}%` : '—'}
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[10px] text-[#9EACC4]/70">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-[#A78BFA]" />
              Backend: {tensorStats.backend}
            </span>
            <span>Tensors: {tensorStats.tensorsCount}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
