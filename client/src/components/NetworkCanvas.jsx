import React, { useRef, useEffect } from 'react';
import { Trash2, Plus, Sparkles, Activity } from 'lucide-react';

export default function NetworkCanvas({
  viewMode = 'architecture', // 'architecture' | 'neurons'
  layers = [],
  selectedLayerIndex = 1,
  selectedNeuronIndex = 0,
  onSelectLayer,
  onSelectNeuron,
  onRemoveLayer,
  onAddLayer,
  modelWeights = [],
  activations = [],
  gridSurface = null,
  datasetPoints = [],
  datasetName = 'XOR Problem',
}) {
  const neuronCanvasRef = useRef(null);

  // Render Neuron Mode Canvas
  useEffect(() => {
    if (viewMode !== 'neurons') return;
    const canvas = neuronCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = (canvas.width = canvas.parentElement.clientWidth);
    const height = (canvas.height = canvas.parentElement.clientHeight || 450);

    ctx.clearRect(0, 0, width, height);

    // Compute coordinates for each neuron
    const layerSpacing = width / (layers.length + 1);
    const layerNodes = layers.map((layer, lIdx) => {
      const x = (lIdx + 1) * layerSpacing;
      const count = layer.units;
      const ySpacing = height / (count + 1);
      const nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x,
          y: (i + 1) * ySpacing,
          layerIndex: lIdx,
          neuronIndex: i,
          activation: activations[lIdx]?.values?.[i] ?? 0.5,
        });
      }
      return nodes;
    });

    // 1. Draw Connection Lines between adjacent layers
    for (let l = 0; l < layerNodes.length - 1; l++) {
      const fromNodes = layerNodes[l];
      const toNodes = layerNodes[l + 1];
      const weightsForLayer = modelWeights[l]?.kernel;

      fromNodes.forEach((fromN, fromIdx) => {
        toNodes.forEach((toN, toIdx) => {
          const isTargetNeuronSelected = 
            selectedLayerIndex === l + 1 && selectedNeuronIndex === toIdx;
          const isSourceNeuronSelected = 
            selectedLayerIndex === l && selectedNeuronIndex === fromIdx;

          const weightVal = weightsForLayer?.[fromIdx]?.[toIdx] ?? 0.5;
          const absWeight = Math.min(4, Math.max(0.8, Math.abs(weightVal) * 2));

          ctx.beginPath();
          ctx.moveTo(fromN.x, fromN.y);
          ctx.lineTo(toN.x, toN.y);

          if (isTargetNeuronSelected || isSourceNeuronSelected) {
            ctx.lineWidth = Math.max(2.5, absWeight + 1.5);
            ctx.strokeStyle = weightVal >= 0 ? '#46D7F2' : '#F3B65E';
          } else {
            ctx.lineWidth = Math.min(2, absWeight * 0.7);
            ctx.strokeStyle = weightVal >= 0 
              ? 'rgba(70, 215, 242, 0.15)' 
              : 'rgba(243, 182, 94, 0.15)';
          }
          ctx.stroke();
        });
      });
    }

    // 2. Draw Circular Neurons
    layerNodes.forEach((nodes, lIdx) => {
      nodes.forEach((n, nIdx) => {
        const isSelected = selectedLayerIndex === lIdx && selectedNeuronIndex === nIdx;
        const radius = isSelected ? 16 : 13;

        // Outer glow on selected neuron
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(70, 215, 242, 0.25)';
          ctx.fill();
        }

        // Neuron Body
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);

        // Color mapped to activation intensity
        const act = Math.max(0, Math.min(1, n.activation));
        if (lIdx === 0) {
          ctx.fillStyle = '#151E30';
          ctx.strokeStyle = '#46D7F2';
        } else if (lIdx === layers.length - 1) {
          ctx.fillStyle = `rgba(60, 213, 170, ${0.3 + act * 0.7})`;
          ctx.strokeStyle = '#3CD5AA';
        } else {
          ctx.fillStyle = `rgba(167, 139, 250, ${0.2 + act * 0.8})`;
          ctx.strokeStyle = isSelected ? '#46D7F2' : '#A78BFA';
        }

        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Label inside neuron
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.activation.toFixed(2), n.x, n.y);
      });
    });

  }, [viewMode, layers, selectedLayerIndex, selectedNeuronIndex, modelWeights, activations]);

  // Handle click on Neuron Canvas to select specific neuron
  const handleNeuronCanvasClick = (e) => {
    const canvas = neuronCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const layerSpacing = canvas.width / (layers.length + 1);
    layers.forEach((layer, lIdx) => {
      const x = (lIdx + 1) * layerSpacing;
      const count = layer.units;
      const ySpacing = canvas.height / (count + 1);
      for (let i = 0; i < count; i++) {
        const y = (i + 1) * ySpacing;
        if (Math.hypot(clickX - x, clickY - y) < 18) {
          onSelectLayer(lIdx);
          onSelectNeuron(i);
          return;
        }
      }
    });
  };

  return (
    <div className="w-full h-full relative flex items-center justify-center p-6 bg-grid-pattern overflow-hidden">
      
      {viewMode === 'architecture' ? (
        /* Architecture Mode: Flow of Layers */
        <div className="flex items-center gap-6 max-w-5xl py-8 overflow-x-auto">
          {layers.map((layer, idx) => {
            const isSelected = selectedLayerIndex === idx;
            const isHidden = layer.type === 'Dense';
            const prevUnits = idx === 0 ? 2 : layers[idx - 1].units;
            const weightCount = prevUnits * layer.units;
            const biasCount = layer.units;
            const paramCount = layer.type === 'Input' ? 0 : weightCount + biasCount;

            return (
              <React.Fragment key={layer.id || idx}>
                <div
                  onClick={() => onSelectLayer(idx)}
                  className={`w-44 p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-56 relative shadow-xl ${
                    isSelected
                      ? 'bg-[#151E30] border-[#46D7F2] shadow-glow-cyan scale-105 z-10'
                      : 'bg-[#151E30]/80 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${
                        layer.type === 'Input' ? 'text-[#46D7F2]' : layer.type === 'Output' ? 'text-[#3CD5AA]' : 'text-[#A78BFA]'
                      }`}>
                        {layer.type}
                      </span>
                      {isHidden && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveLayer(idx);
                          }}
                          className="text-[#9EACC4] hover:text-red-400 p-1 rounded-lg transition-colors"
                          title="Remove this layer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <h4 className="text-base font-semibold text-white mt-1.5 font-display">
                      {layer.type === 'Input' ? 'Input Layer' : layer.type === 'Output' ? 'Output Layer' : `Hidden L${idx}`}
                    </h4>

                    <div className="mt-3 space-y-1 text-xs font-mono">
                      <div className="text-white font-semibold">
                        {layer.units} {layer.units === 1 ? 'Neuron' : 'Neurons'}
                      </div>
                      <div className="text-[#9EACC4] text-[11px]">
                        Act: <span className="text-[#A78BFA]">{layer.activation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Weight calculation summary */}
                  <div className="pt-3 border-t border-white/10 text-[10px] font-mono text-[#9EACC4] space-y-0.5">
                    {layer.type !== 'Input' ? (
                      <>
                        <div className="flex justify-between">
                          <span>Weights (W):</span>
                          <span className="text-white">{weightCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Biases (b):</span>
                          <span className="text-white">{biasCount}</span>
                        </div>
                        <div className="flex justify-between text-[#3CD5AA] font-bold pt-0.5">
                          <span>Params:</span>
                          <span>{paramCount}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[#46D7F2]">Feature Inputs: x1, x2</div>
                    )}
                  </div>
                </div>

                {/* Animated Directional Connector */}
                {idx < layers.length - 1 && (
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-[#A78BFA]/60 via-[#46D7F2] to-[#3CD5AA]/60 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#46D7F2] shadow-sm animate-ping" />
                    </div>
                    <span className="text-[9px] font-mono text-[#9EACC4] mt-1.5">
                      {layers[idx].units}×{layers[idx + 1].units}
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        /* Neuron Mode: Deep Node & Connection Mesh */
        <div className="w-full h-full relative flex items-center justify-center">
          <canvas
            ref={neuronCanvasRef}
            onClick={handleNeuronCanvasClick}
            className="w-full h-full cursor-pointer"
          />
        </div>
      )}

      {/* Embedded 2D Decision Boundary Surface Thumbnail in Corner */}
      {gridSurface && (
        <div className="absolute bottom-4 right-4 z-20 w-44 h-44 rounded-2xl border border-white/15 bg-[#080D18]/95 backdrop-blur-md p-2.5 shadow-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center text-[10px] font-mono text-[#9EACC4]">
            <span className="text-[#46D7F2] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3CD5AA] animate-pulse" />
              Decision Surface
            </span>
            <span>2D</span>
          </div>

          <div className="w-full h-28 relative rounded-lg overflow-hidden border border-white/10 bg-black">
            {/* Meshgrid Heatmap */}
            <div className="grid grid-cols-20 h-full w-full">
              {gridSurface.grid.flat().map((prob, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: prob > 0.5 
                      ? `rgba(167, 139, 250, ${Math.min(0.9, (prob - 0.5) * 1.8)})` 
                      : `rgba(70, 215, 242, ${Math.min(0.9, (0.5 - prob) * 1.8)})`
                  }}
                />
              ))}
            </div>

            {/* Scatter Dots */}
            {datasetPoints.slice(0, 40).map((pt, idx) => {
              const leftPercent = ((pt.x + 2.5) / 5) * 100;
              const topPercent = ((-pt.y + 2.5) / 5) * 100;
              return (
                <div
                  key={idx}
                  className={`absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${
                    pt.label === 1 ? 'bg-[#A78BFA]' : 'bg-[#46D7F2]'
                  }`}
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                />
              );
            })}
          </div>

          <div className="text-[9px] font-mono text-[#9EACC4] truncate">
            Dataset: <span className="text-white">{datasetName}</span>
          </div>
        </div>
      )}
    </div>
  );
}
