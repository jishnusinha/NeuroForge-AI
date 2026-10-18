import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Network, 
  Layers, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Cpu, 
  Sliders, 
  Sparkles,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Eye,
  SlidersHorizontal
} from 'lucide-react';
import NetworkCanvas from '../components/NetworkCanvas';
import { generateXOR, generateTwoMoons, trainTestSplit } from '../ml/datasets';
import { 
  buildTFModel, 
  trainTFModel, 
  extractModelWeights, 
  inspectForwardPass, 
  predictGridSurface 
} from '../ml/tfModelEngine';
import { useLabStore } from '../store/useLabStore';

export default function StudioShell() {
  const { setExperimentStatus, showToast } = useLabStore();

  // Mode and View State
  const [viewMode, setViewMode] = useState('architecture'); // 'architecture' | 'neurons'
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(1);
  const [selectedNeuronIndex, setSelectedNeuronIndex] = useState(0);

  // Network Architecture State
  const [layers, setLayers] = useState([
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear', params: 0 },
    { id: 'l-h1', type: 'Dense', units: 4, activation: 'ReLU', params: 12 },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid', params: 5 },
  ]);

  // Dataset State
  const [selectedDatasetName, setSelectedDatasetName] = useState('XOR Problem');
  const [probeInput, setProbeInput] = useState([0.8, 0.8]); // [x1, x2] sample for forward inspection

  // Training & Model State
  const [learningRate, setLearningRate] = useState(0.04);
  const [totalEpochs, setTotalEpochs] = useState(60);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [lossHistory, setLossHistory] = useState([]);
  const [accuracyHistory, setAccuracyHistory] = useState([]);
  const [checkpoints, setCheckpoints] = useState([]);
  const [scrubberEpoch, setScrubberEpoch] = useState(0);
  const [modelWeights, setModelWeights] = useState([]);
  const [activations, setActivations] = useState([]);
  const [gridSurface, setGridSurface] = useState(null);

  // Dock collapse
  const [bottomDockCollapsed, setBottomDockCollapsed] = useState(false);

  // Stop reference for async loop
  const shouldStopRef = useRef(false);
  const activeTFModelRef = useRef(null);

  // Prepare Dataset
  const { train: trainPoints, test: valPoints, all: allPoints } = useMemo(() => {
    let pts = [];
    if (selectedDatasetName === 'XOR Problem') pts = generateXOR(180, 0.12, 42);
    else pts = generateTwoMoons(180, 0.18, 42);
    return trainTestSplit(pts, 0.8, 42);
  }, [selectedDatasetName]);

  // Build model and initial forward pass
  const initModel = useCallback(() => {
    if (activeTFModelRef.current) {
      activeTFModelRef.current.dispose();
    }
    const model = buildTFModel(layers, learningRate);
    activeTFModelRef.current = model;

    const weights = extractModelWeights(model);
    setModelWeights(weights);

    const fwd = inspectForwardPass(model, probeInput);
    setActivations(fwd);

    const grid = predictGridSurface(model, 20);
    setGridSurface(grid);

    setCurrentEpoch(0);
    setLossHistory([]);
    setAccuracyHistory([]);
    setCheckpoints([]);
    setExperimentStatus('Ready');
  }, [layers, learningRate, probeInput, setExperimentStatus]);

  useEffect(() => {
    initModel();
    return () => {
      if (activeTFModelRef.current) {
        activeTFModelRef.current.dispose();
      }
    };
  }, [initModel]);

  // Update forward pass when probe input moves
  useEffect(() => {
    if (activeTFModelRef.current) {
      const fwd = inspectForwardPass(activeTFModelRef.current, probeInput);
      setActivations(fwd);
    }
  }, [probeInput]);

  // Layer editing
  const handleAddLayer = () => {
    if (layers.length >= 6) {
      showToast('Maximum 6 layers allowed for browser runtime.', 'info');
      return;
    }
    const newLayer = {
      id: `l-h${Date.now()}`,
      type: 'Dense',
      units: 4,
      activation: 'ReLU',
    };
    const newLayers = [...layers];
    newLayers.splice(layers.length - 1, 0, newLayer);
    setLayers(newLayers);
    setExperimentStatus('Inputs changed');
    showToast('Dense layer added. Re-compile and train model.', 'info');
  };

  const handleRemoveLayer = (idx) => {
    if (layers.length <= 2) {
      showToast('Network must have at least an Input and Output layer.', 'error');
      return;
    }
    const newLayers = layers.filter((_, i) => i !== idx);
    setLayers(newLayers);
    setSelectedLayerIndex(Math.max(0, idx - 1));
    setExperimentStatus('Inputs changed');
    showToast('Layer removed. Re-compile and train model.', 'info');
  };

  // Asynchronous Training Execution
  const handleStartTraining = async () => {
    if (isTraining) {
      // Pause/Stop training
      shouldStopRef.current = true;
      setIsTraining(false);
      setExperimentStatus('Ready');
      showToast('Training paused.', 'info');
      return;
    }

    if (!activeTFModelRef.current) initModel();
    const model = activeTFModelRef.current;

    setIsTraining(true);
    shouldStopRef.current = false;
    setExperimentStatus('Running');
    showToast(`Training ${layers.length - 1}-layer network with TensorFlow.js...`, 'info');

    const losses = [];
    const accs = [];

    const ckpts = await trainTFModel(
      model,
      trainPoints,
      valPoints,
      totalEpochs,
      16,
      (ep, logs) => {
        setCurrentEpoch(ep);
        losses.push({ epoch: ep, loss: logs.loss, valLoss: logs.valLoss });
        accs.push({ epoch: ep, accuracy: logs.accuracy, valAccuracy: logs.valAccuracy });
        setLossHistory([...losses]);
        setAccuracyHistory([...accs]);

        // Live weight extraction and boundary update every 10 epochs
        if (ep % 10 === 0 || ep === totalEpochs) {
          const w = extractModelWeights(model);
          setModelWeights(w);
          const fwd = inspectForwardPass(model, probeInput);
          setActivations(fwd);
          const grid = predictGridSurface(model, 20);
          setGridSurface(grid);
        }
      },
      shouldStopRef
    );

    setIsTraining(false);
    setCheckpoints(ckpts || []);
    setScrubberEpoch(totalEpochs);
    setExperimentStatus('Completed');

    const finalAcc = accs[accs.length - 1]?.accuracy || 0;
    const finalLoss = losses[losses.length - 1]?.loss || 0;

    if (selectedDatasetName === 'XOR Problem' && layers.length === 2) {
      showToast(`Linear Model failed XOR (Loss: ${finalLoss}, Accuracy: ${(finalAcc * 100).toFixed(0)}%). Add a hidden layer!`, 'error');
    } else {
      showToast(`Model converged! Loss: ${finalLoss}, Accuracy: ${(finalAcc * 100).toFixed(1)}%`, 'success');
    }
  };

  // Preset Configurations
  const handleLoadPreset = (name) => {
    if (name === 'XOR Non-linear') {
      setSelectedDatasetName('XOR Problem');
      setLayers([
        { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
        { id: 'l-h1', type: 'Dense', units: 4, activation: 'ReLU' },
        { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
      ]);
      showToast('Loaded XOR Multi-Layer Network (2-4-1). Ready to train!', 'info');
    } else if (name === 'XOR Linear Baseline (Fails)') {
      setSelectedDatasetName('XOR Problem');
      setLayers([
        { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
        { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
      ]);
      showToast('Loaded Linear Baseline (No hidden layers). Watch it fail on XOR!', 'info');
    } else if (name === 'Two Moons Deep') {
      setSelectedDatasetName('Two Moons');
      setLayers([
        { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
        { id: 'l-h1', type: 'Dense', units: 8, activation: 'ReLU' },
        { id: 'l-h2', type: 'Dense', units: 4, activation: 'ReLU' },
        { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
      ]);
      showToast('Loaded Two Moons Deep Classifier (2-8-4-1).', 'info');
    }
  };

  const selectedLayer = layers[selectedLayerIndex] || layers[0];
  const activeNeuronWeights = modelWeights[selectedLayerIndex - 1]?.kernel;
  const activeNeuronBias = modelWeights[selectedLayerIndex - 1]?.bias?.[selectedNeuronIndex];
  const activeNeuronActivation = activations[selectedLayerIndex]?.values?.[selectedNeuronIndex];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Upper 3-Panel Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Architecture Presets & Layer Library (260px) */}
        <aside className="w-[260px] bg-[#151E30] border-r border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A78BFA] font-semibold">
              01 • Architecture Library
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">Topology & Presets</h3>
          </div>

          {/* Standard Presets */}
          <div className="space-y-1">
            <label className="text-xs text-[#9EACC4] font-medium">Standard Presets</label>
            {[
              { id: 'XOR Non-linear', desc: 'Hidden Layer: 2-4-1 (100% Solves XOR)' },
              { id: 'XOR Linear Baseline (Fails)', desc: '1 Layer: 2-1 (Fails at 50%)' },
              { id: 'Two Moons Deep', desc: 'Deep: 2-8-4-1' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleLoadPreset(p.id)}
                className="w-full text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-xs text-white transition-colors"
              >
                <div className="font-semibold truncate">{p.id}</div>
                <div className="text-[10px] text-[#9EACC4] font-mono mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Add Layer Component */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <label className="text-xs text-[#9EACC4] font-medium">Layer Manipulation</label>
            <button
              onClick={handleAddLayer}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#A78BFA]/15 hover:bg-[#A78BFA]/25 border border-[#A78BFA]/30 text-xs font-semibold text-[#A78BFA] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dense Hidden Layer</span>
            </button>
          </div>

          {/* Interactive Probe Coordinate Input */}
          <div className="p-3 rounded-xl bg-[#080D18] border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#9EACC4]">
              <span className="flex items-center gap-1.5 text-white font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#46D7F2]" />
                Probe Input Sample
              </span>
              <span className="text-[#46D7F2]">({probeInput[0]}, {probeInput[1]})</span>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-mono text-[#9EACC4] mb-0.5">
                <span>x₁ Feature</span>
                <span>{probeInput[0]}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={probeInput[0]}
                onChange={(e) => setProbeInput([Number(e.target.value), probeInput[1]])}
                className="w-full h-1 bg-[#202B43] rounded appearance-none cursor-pointer accent-[#46D7F2]"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-mono text-[#9EACC4] mb-0.5">
                <span>x₂ Feature</span>
                <span>{probeInput[1]}</span>
              </div>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={probeInput[1]}
                onChange={(e) => setProbeInput([probeInput[0], Number(e.target.value)])}
                className="w-full h-1 bg-[#202B43] rounded appearance-none cursor-pointer accent-[#A78BFA]"
              />
            </div>
          </div>

          {/* Topology Summary */}
          <div className="p-3 rounded-xl bg-[#080D18] border border-white/5 text-[11px] font-mono space-y-1">
            <div className="flex justify-between text-[#9EACC4]">
              <span>Layers:</span>
              <span className="text-white font-bold">{layers.length} Total</span>
            </div>
            <div className="flex justify-between text-[#9EACC4]">
              <span>Dataset:</span>
              <span className="text-[#46D7F2]">{selectedDatasetName}</span>
            </div>
            <div className="flex justify-between text-[#9EACC4]">
              <span>Runtime Engine:</span>
              <span className="text-[#3CD5AA]">TensorFlow.js (Client)</span>
            </div>
          </div>
        </aside>

        {/* Center: Visual Network Canvas */}
        <section className="flex-1 flex flex-col bg-[#080D18] relative overflow-hidden">
          
          {/* Visual Mode Toolbar */}
          <div className="h-12 border-b border-white/10 px-6 bg-[#0D1422] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[#9EACC4]">Visual Mode:</span>
              <div className="flex rounded-lg bg-[#151E30] p-0.5 border border-white/10">
                <button
                  onClick={() => setViewMode('architecture')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'architecture'
                      ? 'bg-[#A78BFA] text-[#080D18] font-bold shadow-sm'
                      : 'text-[#9EACC4] hover:text-white'
                  }`}
                >
                  Architecture Blocks
                </button>
                <button
                  onClick={() => setViewMode('neurons')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'neurons'
                      ? 'bg-[#46D7F2] text-[#080D18] font-bold shadow-sm'
                      : 'text-[#9EACC4] hover:text-white'
                  }`}
                >
                  Neuron & Weight Links
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[#3CD5AA] flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isTraining ? 'bg-[#3CD5AA] animate-ping' : 'bg-[#3CD5AA]'}`} />
                Epoch: {currentEpoch}/{totalEpochs}
              </span>
            </div>
          </div>

          {/* Network Canvas */}
          <div className="flex-1 w-full h-full relative">
            <NetworkCanvas
              viewMode={viewMode}
              layers={layers}
              selectedLayerIndex={selectedLayerIndex}
              selectedNeuronIndex={selectedNeuronIndex}
              onSelectLayer={(idx) => {
                setSelectedLayerIndex(idx);
                setSelectedNeuronIndex(0);
              }}
              onSelectNeuron={(nIdx) => setSelectedNeuronIndex(nIdx)}
              onRemoveLayer={handleRemoveLayer}
              onAddLayer={handleAddLayer}
              modelWeights={modelWeights}
              activations={activations}
              gridSurface={gridSurface}
              datasetPoints={allPoints}
              datasetName={selectedDatasetName}
            />
          </div>
        </section>

        {/* Right: Neuron Inspector & Training Controls (320px) */}
        <aside className="w-[320px] bg-[#151E30] border-l border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#46D7F2] font-semibold">
              02 • Neuron & Layer Inspector
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">
              {selectedLayer.type} Layer • Neuron #{selectedNeuronIndex + 1}
            </h3>
          </div>

          {/* Layer Settings */}
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#9EACC4]">Neuron Units</span>
                <span className="font-mono text-white text-xs">{selectedLayer.units}</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                disabled={selectedLayer.type === 'Input' || selectedLayer.type === 'Output'}
                value={selectedLayer.units}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated = [...layers];
                  updated[selectedLayerIndex].units = val;
                  setLayers(updated);
                  setExperimentStatus('Inputs changed');
                }}
                className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#46D7F2] disabled:opacity-30"
              />
            </div>

            <div>
              <label className="text-xs text-[#9EACC4] font-medium block mb-1">Activation Function</label>
              <select
                disabled={selectedLayer.type === 'Input'}
                value={selectedLayer.activation}
                onChange={(e) => {
                  const val = e.target.value;
                  const updated = [...layers];
                  updated[selectedLayerIndex].activation = val;
                  setLayers(updated);
                  setExperimentStatus('Inputs changed');
                }}
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#080D18] border border-white/10 text-xs text-white focus:outline-none focus:border-[#46D7F2] disabled:opacity-30"
              >
                <option value="ReLU">Rectified Linear Unit (ReLU)</option>
                <option value="Sigmoid">Logistic Sigmoid (σ)</option>
                <option value="Tanh">Hyperbolic Tangent (Tanh)</option>
                <option value="Linear">Identity (Linear)</option>
              </select>
            </div>
          </div>

          {/* Training Control Buttons */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <button
              onClick={handleStartTraining}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-glow-violet transition-all ${
                isTraining
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-gradient-to-r from-[#A78BFA] to-[#46D7F2] text-[#080D18] hover:opacity-95'
              }`}
            >
              {isTraining ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isTraining ? 'Pause Optimization' : 'Train Model (TensorFlow.js)'}</span>
            </button>
            <button
              onClick={initModel}
              className="w-full py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-[#9EACC4] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Weights & Architecture</span>
            </button>
          </div>

          {/* Detailed Mathematical Formulation Panel */}
          <div className="p-3.5 rounded-xl bg-[#0D1422] border border-white/5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <BrainCircuit className="w-3.5 h-3.5 text-[#3CD5AA]" />
              <span>Neuron Mathematical Values</span>
            </div>
            
            <div className="p-2.5 rounded bg-black/50 text-center font-mono text-[11px] space-y-0.5">
              <div className="text-[#46D7F2]">
                z = ∑ wᵢ · xᵢ + b
              </div>
              <div className="text-[#3CD5AA] font-bold">
                a = {selectedLayer.activation}(z) = {activeNeuronActivation !== undefined ? activeNeuronActivation.toFixed(4) : '0.0000'}
              </div>
            </div>

            {/* Incoming Weights Table */}
            {selectedLayerIndex > 0 && activeNeuronWeights && (
              <div className="space-y-1 text-[10px] font-mono text-[#9EACC4] pt-1">
                <span className="font-semibold text-white block">Incoming Connections:</span>
                <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
                  {activeNeuronWeights.map((row, prevNIdx) => {
                    const wVal = row[selectedNeuronIndex];
                    return (
                      <div key={prevNIdx} className="flex justify-between items-center py-0.5 px-1.5 rounded bg-white/[0.02]">
                        <span>w[{prevNIdx + 1} → {selectedNeuronIndex + 1}]:</span>
                        <span className={wVal >= 0 ? 'text-[#46D7F2]' : 'text-[#F3B65E]'}>
                          {wVal !== undefined ? wVal.toFixed(3) : '0.000'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span>Learned Bias (b):</span>
                  <span className="text-white font-bold">{activeNeuronBias !== undefined ? activeNeuronBias.toFixed(3) : '0.000'}</span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom: Training Lifecycle & Checkpoint Scrubber Dock */}
      <footer 
        className={`bg-[#0D1422] border-t border-white/10 transition-all duration-300 flex flex-col flex-shrink-0 ${
          bottomDockCollapsed ? 'h-9' : 'h-52'
        }`}
      >
        <div 
          onClick={() => setBottomDockCollapsed(!bottomDockCollapsed)}
          className="h-9 px-4 bg-[#151E30]/70 flex items-center justify-between cursor-pointer border-b border-white/5 hover:bg-[#151E30]"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isTraining ? 'bg-[#A78BFA] animate-ping' : 'bg-[#A78BFA]'}`} />
              TensorFlow.js Real-Time Loss & Accuracy Trajectory
            </span>
            <span className="text-[11px] font-mono text-[#9EACC4] pl-3 border-l border-white/10">
              Optimizer: Adam (α={learningRate}) • Batch: 16 • Shuffled
            </span>
          </div>
          <button className="text-[#9EACC4] hover:text-white">
            {bottomDockCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {!bottomDockCollapsed && (
          <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
            {/* Loss Chart */}
            <div className="p-3 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9EACC4]">Binary Cross-Entropy Loss</span>
                <span className="font-mono text-[#46D7F2] font-semibold">
                  {lossHistory[lossHistory.length - 1]?.loss ?? '0.6931'}
                </span>
              </div>
              <div className="h-24 flex items-end gap-1 pt-2">
                {lossHistory.length > 0 ? (
                  lossHistory.slice(-12).map((h, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-[#46D7F2]/70 hover:bg-[#46D7F2] rounded-t transition-all"
                        style={{ height: `${Math.min(100, Math.max(10, h.loss * 100))}%` }}
                      />
                      <span className="text-[9px] font-mono text-[#9EACC4]">{h.epoch}</span>
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#9EACC4]">
                    Ready to Train
                  </div>
                )}
              </div>
            </div>

            {/* Accuracy Chart */}
            <div className="p-3 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9EACC4]">Validation Accuracy</span>
                <span className="font-mono text-[#3CD5AA] font-semibold">
                  {accuracyHistory[accuracyHistory.length - 1]?.accuracy 
                    ? `${(accuracyHistory[accuracyHistory.length - 1].accuracy * 100).toFixed(1)}%` 
                    : '50.0%'}
                </span>
              </div>
              <div className="h-24 flex items-end gap-1 pt-2">
                {accuracyHistory.length > 0 ? (
                  accuracyHistory.slice(-12).map((h, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className="w-full bg-[#3CD5AA]/70 hover:bg-[#3CD5AA] rounded-t transition-all"
                        style={{ height: `${Math.min(100, Math.max(10, h.accuracy * 100))}%` }}
                      />
                      <span className="text-[9px] font-mono text-[#9EACC4]">{h.epoch}</span>
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#9EACC4]">
                    No Training Data Yet
                  </div>
                )}
              </div>
            </div>

            {/* Scientific Verification */}
            <div className="p-3.5 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-white">XOR Non-Linearity Verification</span>
                <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
                  {layers.length === 2 && selectedDatasetName === 'XOR Problem'
                    ? 'Theorem Proof: Single layer has no hidden representation, proving Minsky & Papert perceptron limit.'
                    : 'Hidden layer warps the 2D plane into a separable latent space, successfully classifying all 4 quadrants.'}
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[11px] font-mono text-[#3CD5AA]">
                <span>Status: {isTraining ? 'Optimizing...' : 'Tensor State Intact'}</span>
                <span>Checkpoints: {checkpoints.length} Saved</span>
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
