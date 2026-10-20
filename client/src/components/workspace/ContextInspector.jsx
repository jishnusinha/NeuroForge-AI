import React from 'react';
import { 
  X, 
  Layers, 
  Target, 
  Activity, 
  Cpu, 
  Compass, 
  Hash, 
  Info 
} from 'lucide-react';
import { useLabStore } from '../../store/useLabStore';

export default function ContextInspector({ className = '' }) {
  const { selectedContext, clearSelectedContext } = useLabStore();

  if (!selectedContext) {
    return (
      <div className={`p-4 rounded-xl bg-obsidian/50 border border-white/5 text-xs text-text-muted flex flex-col items-center justify-center text-center gap-2 ${className}`}>
        <Compass className="w-6 h-6 text-text-muted/40" />
        <span className="font-semibold text-white/80">Context Inspector</span>
        <p className="text-[11px] leading-relaxed max-w-xs text-text-muted/70">
          Click on any data point, network layer, neuron, or metric point to inspect live parameters and measurements.
        </p>
      </div>
    );
  }

  const { type, data } = selectedContext;

  return (
    <div 
      className={`rounded-xl bg-obsidian border border-white/10 p-4 text-xs font-mono shadow-lg transition-all flex flex-col ${className}`}
      role="region"
      aria-label={`Context Inspector: ${type}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          {type === 'layer' && <Layers className="w-4 h-4 text-neural-violet" />}
          {type === 'neuron' && <Cpu className="w-4 h-4 text-plasma-cyan" />}
          {type === 'sample' && <Target className="w-4 h-4 text-quantum-mint" />}
          {type === 'metric' && <Activity className="w-4 h-4 text-signal-amber" />}
          {type === 'run' && <Hash className="w-4 h-4 text-plasma-cyan" />}
          <span className="font-semibold text-white capitalize">{type} Inspector</span>
        </div>
        <button
          onClick={clearSelectedContext}
          className="p-1 rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body per type */}
      <div className="space-y-2.5 overflow-y-auto max-h-72 pr-1">
        {type === 'layer' && (
          <>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Layer Index:</span>
              <span className="text-white font-semibold">{data.index}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Layer Type:</span>
              <span className="text-plasma-cyan font-semibold">{data.type || 'Dense'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Units (Neurons):</span>
              <span className="text-white font-semibold">{data.units}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Activation Function:</span>
              <span className="text-neural-violet font-semibold">{data.activation || 'None'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Trainable Parameters:</span>
              <span className="text-quantum-mint font-semibold">{data.params ?? 'Calculated at compile'}</span>
            </div>
            {data.inputShape && (
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-text-muted">Input Shape:</span>
                <span className="text-white">{JSON.stringify(data.inputShape)}</span>
              </div>
            )}
          </>
        )}

        {type === 'neuron' && (
          <>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Neuron Coordinate:</span>
              <span className="text-white font-semibold">Layer {data.layerIndex}, Unit {data.neuronIndex}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Learned Bias (b):</span>
              <span className="text-white font-semibold">
                {data.bias !== undefined && data.bias !== null ? Number(data.bias).toFixed(4) : '0.0000'}
              </span>
            </div>
            {data.activationValue !== undefined && (
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-text-muted">Active Output:</span>
                <span className="text-quantum-mint font-semibold">
                  {Number(data.activationValue).toFixed(4)}
                </span>
              </div>
            )}
            {data.weights && data.weights.length > 0 && (
              <div>
                <span className="text-text-muted block mb-1.5">Input Weights (w):</span>
                <div className="grid grid-cols-2 gap-1.5 bg-deep-space/60 p-2 rounded-lg border border-white/5">
                  {data.weights.map((w, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="text-text-muted">w_{idx}:</span>
                      <span className={w >= 0 ? 'text-plasma-cyan' : 'text-signal-amber'}>
                        {Number(w).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {type === 'sample' && (
          <>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Sample ID:</span>
              <span className="text-white font-semibold">{data.id ?? 'Selected point'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Split Membership:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                data.split === 'train' ? 'bg-plasma-cyan/20 text-plasma-cyan' : 'bg-neural-violet/20 text-neural-violet'
              }`}>
                {data.split ? data.split.toUpperCase() : 'HELD-OUT'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Ground Truth Label:</span>
              <span className="text-white font-semibold">Class {data.label ?? data.y}</span>
            </div>
            {data.x1 !== undefined && data.x2 !== undefined && (
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-text-muted">Features (x1, x2):</span>
                <span className="text-white font-semibold">
                  [{Number(data.x1).toFixed(3)}, {Number(data.x2).toFixed(3)}]
                </span>
              </div>
            )}
            {data.prediction !== undefined && (
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-text-muted">Predicted P(Y=1):</span>
                <span className="text-quantum-mint font-semibold">
                  {Number(data.prediction).toFixed(4)}
                </span>
              </div>
            )}
            {data.residual !== undefined && (
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-text-muted">Residual Error:</span>
                <span className="text-alert-pink font-semibold">
                  {Number(data.residual).toFixed(4)}
                </span>
              </div>
            )}
          </>
        )}

        {type === 'metric' && (
          <>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Metric:</span>
              <span className="text-white font-semibold">{data.name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Epoch / Step:</span>
              <span className="text-white font-semibold">{data.epoch}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Training Value:</span>
              <span className="text-plasma-cyan font-semibold">
                {data.trainValue !== undefined && data.trainValue !== null ? Number(data.trainValue).toFixed(4) : 'Not measured'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Validation Value:</span>
              <span className="text-quantum-mint font-semibold">
                {data.valValue !== undefined && data.valValue !== null ? Number(data.valValue).toFixed(4) : 'Not measured'}
              </span>
            </div>
          </>
        )}

        {type === 'run' && (
          <>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Run ID:</span>
              <span className="text-white truncate max-w-[180px]">{data.id}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Algorithm:</span>
              <span className="text-plasma-cyan font-semibold">{data.algorithm}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-white/5">
              <span className="text-text-muted">Status:</span>
              <span className="text-quantum-mint font-semibold">{data.status}</span>
            </div>
          </>
        )}
      </div>

      <div className="pt-2 mt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-text-muted/60">
        <Info className="w-3 h-3 flex-shrink-0" />
        <span>Evidence grounded in immutable experiment record.</span>
      </div>
    </div>
  );
}
