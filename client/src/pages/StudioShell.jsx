import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  SlidersHorizontal
} from 'lucide-react';
import NetworkCanvas from '../components/NetworkCanvas';
import { generateXOR, generateTwoMoons, trainTestSplit } from '../ml/datasets';
import {
  buildTFModel,
  extractModelWeights,
  inspectForwardPass,
  predictGridSurface
} from '../ml/tfModelEngine';
import { useLabStore } from '../store/useLabStore';
import { fingerprint } from '../ml/experiments';
import * as tf from '@tensorflow/tfjs';
import { useHistory } from '../store/useHistory';
import UnifiedChart from '../components/workspace/UnifiedChart';
import ContextInspector from '../components/workspace/ContextInspector';
import { modelRunner } from '../ml/modelRunner.js';
import { deserializeModelArtifact } from '../ml/modelArtifacts.js';
import NeuralStudioDiagnostics from '../components/workspace/NeuralStudioDiagnostics.jsx';
import ErrorExplorer from '../components/workspace/ErrorExplorer.jsx';
import { isFeatureEnabled } from '../services/productionConfig.js';
import { draftManager } from '../services/draftManager';


export default function StudioShell() {
  const currentRunId = useLabStore(state=>state.activeRun?.runId || 'unsaved-inspection');
  const {
    setExperimentStatus,
    setActiveRun,
    setInspection,
    pendingRun,
    clearPendingRun,
    showToast,
    viewMode: workspaceViewMode,
    setSelectedContext
  } = useLabStore();

  const [initialRun] = useState(() => pendingRun?.workspace === 'studio' ? pendingRun : null);
  const draftIdentity = useRef({ id: initialRun?._draftId || crypto.randomUUID(), baseRevision: initialRun?._draftRevision ?? 0 });
  const [evaluationSamples, setEvaluationSamples] = useState([]);
  const initialSettings = initialRun?.hyperparameters || {};

  // Mode and View State
  const [viewMode, setViewMode] = useState('architecture'); // 'architecture' | 'neurons'
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(1);
  const [selectedNeuronIndex, setSelectedNeuronIndex] = useState(0);

  // Network Architecture State
  const [layers, setLayers, undoLayers, redoLayers, canUndoLayers, canRedoLayers] = useHistory(initialSettings.layers || [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear', params: 0 },
    { id: 'l-h1', type: 'Dense', units: 4, activation: 'ReLU', params: 12 },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid', params: 5 },
  ]);

  // Dataset State
  const [selectedDatasetName, setSelectedDatasetName] = useState(initialRun?.dataset.name || 'XOR Problem');
  const [datasetNoise, setDatasetNoise] = useState(initialRun?.dataset.noise ?? .12);
  const [probeInput, setProbeInput] = useState([0.8, 0.8]); // [x1, x2] sample for forward inspection

  // Training & Model State
  const [modelSeed,setModelSeed] = useState(initialSettings.seed ?? 42);
  const [earlyStopping,setEarlyStopping] = useState(initialSettings.earlyStopping || {enabled:false,patience:5,minDelta:.001});
  const [learningRate, setLearningRate] = useState(initialSettings.learningRate ?? 0.04);
  const [totalEpochs, setTotalEpochs] = useState(initialSettings.epochs ?? 60);
  const [optimizer, setOptimizer] = useState(initialSettings.optimizer ?? 'adam');
  const [batchSize, setBatchSize] = useState(initialSettings.batchSize ?? 16);
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
  const trainingRef = useRef(false);
  const mountedRef = useRef(true);
  const probeRef = useRef(probeInput);
  const [restoredPoints, setRestoredPoints] = useState(initialRun?.dataset.points || null);
  const [preparation,setPreparation] = useState(initialRun?.dataset.preparation || null);
  const [trainRatio, setTrainRatio] = useState(initialRun?.dataset.trainRatio ?? .8);

  // Prepare Dataset
  const { train: trainPoints, test: valPoints, all: allPoints, source: sourcePoints } = useMemo(() => {
    let pts = [];
    if (restoredPoints) pts = restoredPoints;
    else if (selectedDatasetName === 'XOR Problem') pts = generateXOR(180, 0.12, 42);
    else pts = generateTwoMoons(180, 0.18, 42);
    return { ...trainTestSplit(pts, trainRatio, preparation?.seed ?? 42, preparation?.membership), source: pts };
  }, [selectedDatasetName, restoredPoints, trainRatio, preparation]);

  useEffect(() => { clearPendingRun(); }, [clearPendingRun]);

  // Synchronize selected layer & neuron with ContextInspector
  useEffect(() => {
    const curLayer = layers[selectedLayerIndex] || layers[0];
    const nWeights = modelWeights[selectedLayerIndex - 1]?.kernel;
    const nBias = modelWeights[selectedLayerIndex - 1]?.bias?.[selectedNeuronIndex];
    const nAct = activations[selectedLayerIndex]?.values?.[selectedNeuronIndex];

    setSelectedContext({
      type: 'neuron',
      data: {
        layerIndex: selectedLayerIndex,
        neuronIndex: selectedNeuronIndex,
        bias: nBias,
        weights: nWeights ? nWeights.map(row => row[selectedNeuronIndex]) : [],
        activationValue: nAct,
        layerType: curLayer.type,
      }
    });
  }, [selectedLayerIndex, selectedNeuronIndex, layers, modelWeights, activations, setSelectedContext]);


  // Build model and initial forward pass
  const initModel = useCallback(() => {
    if (trainingRef.current) return;
    if (activeTFModelRef.current) {
      activeTFModelRef.current.optimizer?.dispose();
      activeTFModelRef.current.dispose();
    }
    const model = buildTFModel(layers, learningRate, modelSeed, optimizer);
    activeTFModelRef.current = model;

    const weights = extractModelWeights(model);
    setModelWeights(weights);

    const fwd = inspectForwardPass(model, probeRef.current);
    setActivations(fwd);

    const grid = predictGridSurface(model, 20);
    setGridSurface(grid);

    setCurrentEpoch(0);
    setSelectedLayerIndex(index => Math.min(index, layers.length - 1));
    setSelectedNeuronIndex(0);
    setLossHistory([]);
    setAccuracyHistory([]);
    setCheckpoints([]);
    setScrubberEpoch(0);
    setActiveRun(null);
    setExperimentStatus('Ready');
  }, [layers, learningRate, optimizer, modelSeed, setExperimentStatus, setActiveRun]);

  useEffect(() => {
    if (!isFeatureEnabled('durable_drafts')) return;
    draftManager.queueAutosave({ ...draftIdentity.current, workspace: 'studio', configuration: {
      workspace: 'studio', dataset: { name: selectedDatasetName, points: sourcePoints, noise: datasetNoise, trainRatio, seed: preparation ? null : 42, preparation, preprocessing: initialRun?.dataset.preprocessing || 'none' },
      hyperparameters: { layers, learningRate, optimizer, batchSize, epochs: totalEpochs, seed:modelSeed, earlyStopping },
    } });
  }, [layers, learningRate, optimizer, batchSize, totalEpochs, selectedDatasetName, sourcePoints, datasetNoise, trainRatio, preparation, initialRun, modelSeed, earlyStopping]);
  useEffect(() => { draftManager.setExecutionState(isTraining ? 'running' : 'idle').catch(() => {}); }, [isTraining]);

  useEffect(() => {
    mountedRef.current = true;
    initModel();
    return () => {
      mountedRef.current = false;
      if (trainingRef.current) setExperimentStatus('Interrupted');
      shouldStopRef.current = true;
      if (activeTFModelRef.current && !trainingRef.current) {
        activeTFModelRef.current.optimizer?.dispose();
        activeTFModelRef.current.dispose();
        activeTFModelRef.current = null;
      }
    };
  }, [initModel, sourcePoints, batchSize, setExperimentStatus]);

  useEffect(() => {
    if (!initialRun?.modelArtifact) return;
    let cancelled = false;
    deserializeModelArtifact(initialRun.modelArtifact).then(model => {
      if (cancelled || trainingRef.current) { model.optimizer?.dispose(); model.dispose(); return; }
      const previous = activeTFModelRef.current;
      previous?.optimizer?.dispose(); previous?.dispose(); activeTFModelRef.current = model;
      setModelWeights(extractModelWeights(model)); setActivations(inspectForwardPass(model,probeRef.current)); setGridSurface(predictGridSurface(model,20));
    }).catch(error => showToast(error.message,'error'));
    return () => { cancelled = true; };
  }, [initialRun, showToast]);

  // Update forward pass when probe input moves
  useEffect(() => {
    probeRef.current = probeInput;
    if (activeTFModelRef.current) {
      const fwd = inspectForwardPass(activeTFModelRef.current, probeInput);
      setActivations(fwd);
    }
  }, [probeInput]);

  // Layer editing
  const handleAddLayer = () => {
    if (trainingRef.current) return;
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
    if (trainingRef.current) return;
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
    if (trainingRef.current) {
      // Pause/Stop training
      shouldStopRef.current = true;
      modelRunner.stop();
      showToast('Stopping after the current epoch...', 'info');
      setExperimentStatus('Stopping');
      return;
    }

    initModel();
    const model = activeTFModelRef.current;

    setIsTraining(true);
    trainingRef.current = true;
    setActiveRun(null);
    shouldStopRef.current = false;
    setExperimentStatus('Running');
    showToast(`Training ${layers.length - 1}-layer network with TensorFlow.js...`, 'info');

    const losses = [];
    const accs = [];

    try {
    const runResult = await modelRunner.runTraining({ model, layers, trainPoints, valPoints, epochs: totalEpochs, batchSize, learningRate, optimizer, seed: modelSeed, earlyStopping, shouldStopRef, onEpochEnd: ({ epoch: ep, ...logs }) => {
        if (!mountedRef.current) return;
        setCurrentEpoch(ep);
        losses.push({ epoch: ep, loss: logs.loss, valLoss: logs.valLoss });
        accs.push({ epoch: ep, accuracy: logs.accuracy, valAccuracy: logs.valAccuracy });
        setLossHistory([...losses]);
        setAccuracyHistory([...accs]);

        // Live weight extraction and boundary update every 10 epochs
        if (ep % 10 === 0 || ep === totalEpochs) {
          const w = extractModelWeights(model);
          setModelWeights(w);
          const fwd = inspectForwardPass(model, probeRef.current);
          setActivations(fwd);
          const grid = predictGridSurface(model, 20);
          setGridSurface(grid);
        }
      } });
    const ckpts = runResult.checkpoints;

    if (!mountedRef.current) return;
    setModelWeights(extractModelWeights(model));
    setActivations(inspectForwardPass(model, probeRef.current));
    setGridSurface(predictGridSurface(model, 20));
    setCheckpoints(ckpts || []);
    setScrubberEpoch(losses.at(-1)?.epoch || 0);
    setExperimentStatus(shouldStopRef.current ? 'Stopped' : 'Completed');
    const probabilities = tf.tidy(() => model.predict(tf.tensor2d(valPoints.map(p => [p.x,p.y]))).arraySync().map(row => row[0]));
    setEvaluationSamples(valPoints.map((p,i) => ({ id: p.id, split: 'validation', actual: p.label, predictedProb: probabilities[i], features: { x:p.x,y:p.y } })));
    if (!shouldStopRef.current) setActiveRun({ modelArtifact: runResult.artifact, workspace: 'studio', task: 'classification', name: `${selectedDatasetName} neural network`, algorithm: `Dense MLP (${layers.map(l => l.units).join('-')})`,
      evaluation: { splitSeed: preparation?.seed ?? 42, membership: preparation?.membership || { train: trainPoints.map(p => String(p.id)), validation: valPoints.map(p => String(p.id)), test: [] } },
      dataset: { name: selectedDatasetName, points: sourcePoints, sampleCount: allPoints.length,
        noise: datasetNoise, trainRatio, seed: preparation ? null : 42, preparation,
        fingerprint: fingerprint(sourcePoints), splitFingerprint: fingerprint(valPoints), preprocessing: preparation ? initialRun.dataset.preprocessing : 'none' },
      hyperparameters: { layers: structuredClone(layers), learningRate, epochs: totalEpochs, batchSize, optimizer, seed: modelSeed, earlyStopping },
      metrics: { trainLoss: losses.at(-1)?.loss, valLoss: losses.at(-1)?.valLoss, trainAccuracy: accs.at(-1)?.accuracy, valAccuracy: accs.at(-1)?.valAccuracy },
      metricHistory: losses.map((h, i) => ({ ...h, ...accs[i] })), runtime: { tensorflow: tf.version.tfjs, backend: tf.getBackend(), earlyStopped:runResult.earlyStopped, epochsTrained:losses.length, evaluationWeights:'final' }, status: 'Completed' });

    const finalAcc = accs[accs.length - 1]?.accuracy || 0;
    const finalLoss = losses[losses.length - 1]?.loss || 0;

    if (shouldStopRef.current) showToast('Training stopped. Start a fresh run when ready.', 'info');
    else if (selectedDatasetName === 'XOR Problem' && layers.length === 2) {
      showToast(`Linear Model failed XOR (Loss: ${finalLoss}, Accuracy: ${(finalAcc * 100).toFixed(0)}%). Add a hidden layer!`, 'error');
    } else {
      showToast(`Training finished. Loss: ${finalLoss}, Accuracy: ${(finalAcc * 100).toFixed(1)}%`, 'success');
    }
    } catch (error) {
      if (mountedRef.current) { setExperimentStatus('Failed'); showToast(error.message, 'error'); }
    } finally {
      trainingRef.current = false;
      if (mountedRef.current) setIsTraining(false);
      else { model.optimizer?.dispose(); model.dispose(); if (activeTFModelRef.current === model) activeTFModelRef.current = null; }
    }
  };

  // Preset Configurations
  const handleLoadPreset = (name) => {
    if (trainingRef.current) return;
    setRestoredPoints(null); setPreparation(null);
    setTrainRatio(.8);
    setDatasetNoise(name === 'Two Moons Deep' ? .18 : .12);
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
  const restoreCheckpoint = (epoch) => {
    if (trainingRef.current) return;
    const checkpoint = checkpoints.find(c => c.epoch === epoch);
    const model = activeTFModelRef.current;
    if (!checkpoint || !model) return;
    model.layers.forEach((layer, index) => {
      const snapshot = checkpoint.weights[index];
      const tensors = [tf.tensor2d(snapshot.kernel), tf.tensor1d(snapshot.bias)];
      layer.setWeights(tensors); tensors.forEach(t => t.dispose());
    });
    setInspection(epoch); setScrubberEpoch(epoch); setModelWeights(extractModelWeights(model));
    setActivations(inspectForwardPass(model, probeRef.current)); setGridSurface(predictGridSurface(model, 20));
  };
  const activeNeuronWeights = modelWeights[selectedLayerIndex - 1]?.kernel;
  const activeNeuronBias = modelWeights[selectedLayerIndex - 1]?.bias?.[selectedNeuronIndex];
  const activeNeuronActivation = activations[selectedLayerIndex]?.values?.[selectedNeuronIndex];

  return (
    <div className="lab-workspace min-w-0 flex-1 flex flex-col min-h-[calc(100vh-64px)]">
      {/* Upper 3-Panel Grid */}
      <div className="flex min-w-0 min-h-[620px] overflow-hidden">

        {/* Left: Architecture Presets & Layer Library (260px) */}
        <aside className="w-[260px] bg-[#151E30] border-r border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A78BFA] font-semibold">
              01 • Architecture Library
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">Topology & Presets</h3>
          </div>

          {workspaceViewMode === 'guided' && (
            <div className="p-2.5 rounded-xl bg-[#46D7F2]/10 border border-[#46D7F2]/25 text-xs text-[#9EACC4] space-y-1 font-mono">
              <span className="font-semibold text-[#46D7F2] block">Guided Exploration Tip</span>
              <p className="text-[11px] leading-relaxed">
                Compare <strong className="text-white">XOR Linear Baseline</strong> with <strong className="text-white">XOR Non-linear</strong> to observe how hidden neurons create non-linear boundaries.
              </p>
            </div>
          )}


          {/* Standard Presets */}
          <div className="space-y-1">
            <label className="text-xs text-[#9EACC4] font-medium">Standard Presets</label>
            {[
              { id: 'XOR Non-linear', desc: 'Hidden layer: 2-4-1; inspect measured results' },
              { id: 'XOR Linear Baseline (Fails)', desc: 'Linear baseline: cannot perfectly separate XOR' },
              { id: 'Two Moons Deep', desc: 'Deep: 2-8-4-1' },
            ].map((p) => (
              <button
                key={p.id}
                disabled={isTraining}
                onClick={() => handleLoadPreset(p.id)}
                className="w-full text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 text-xs text-white transition-colors"
              >
                <div className="font-semibold truncate">{p.id}</div>
                <div className="text-[10px] text-[#9EACC4] font-mono mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Add Layer Component */}
          <div className="flex gap-2 text-xs"><button disabled={isTraining || !canUndoLayers} onClick={undoLayers} className="p-2 bg-white/10 rounded disabled:opacity-30">Undo architecture</button><button disabled={isTraining || !canRedoLayers} onClick={redoLayers} className="p-2 bg-white/10 rounded disabled:opacity-30">Redo</button></div>
          <div className="pt-2 border-t border-white/5 space-y-2">
            <label className="text-xs text-[#9EACC4] font-medium">Layer Manipulation</label>
            <button
              disabled={isTraining}
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
                aria-label="Probe x1"
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
                aria-label="Probe x2"
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
        <section className="flex-1 min-w-0 flex flex-col bg-[#080D18] relative overflow-hidden">

          {/* Visual Mode Toolbar */}
          <div className="min-h-12 border-b border-white/10 px-3 sm:px-6 py-2 bg-[#0D1422] flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-xs font-mono text-[#9EACC4]">Visual Mode:</span>
              <div className="flex rounded-lg bg-[#151E30] p-0.5 border border-white/10">
                <button
                  onClick={() => setViewMode('architecture')}
                  className={`px-2 sm:px-3 py-2 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                    viewMode === 'architecture'
                      ? 'bg-[#A78BFA] text-[#080D18] font-bold shadow-sm'
                      : 'text-[#9EACC4] hover:text-white'
                  }`}
                >
                  Architecture Blocks
                </button>
                <button
                  onClick={() => setViewMode('neurons')}
                  className={`px-2 sm:px-3 py-2 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
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
          <label className="text-xs text-[#9EACC4]">Select layer<select aria-label="Selected layer" value={selectedLayerIndex} onChange={e => { setSelectedLayerIndex(Number(e.target.value)); setSelectedNeuronIndex(0); }} className="w-full bg-[#080D18] p-2 rounded">{layers.map((layer,index) => <option key={layer.id} value={index}>{index + 1}. {layer.type} ({layer.units} units)</option>)}</select></label>
          <label className="text-xs text-[#9EACC4]">Inspect neuron<input aria-label="Selected neuron" type="number" min="1" max={selectedLayer.units} value={selectedNeuronIndex+1} onChange={e => setSelectedNeuronIndex(Math.max(0, Math.min(selectedLayer.units-1, Number(e.target.value)-1 || 0)))} className="w-full bg-[#080D18] p-2 rounded" /></label>
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
                disabled={isTraining || selectedLayer.type === 'Input' || selectedLayer.type === 'Output'}
                value={selectedLayer.units}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated = layers.map(l => ({ ...l }));
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
                disabled={isTraining || selectedLayer.type === 'Input' || selectedLayer.type === 'Output'}
                value={selectedLayer.activation}
                onChange={(e) => {
                  const val = e.target.value;
                  const updated = layers.map(l => ({ ...l }));
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
          <label>Model seed<input aria-label="Model seed" type="number" min="0" max="4294967295" disabled={isTraining} value={modelSeed} onChange={event=>setModelSeed(Math.max(0,Math.min(4294967295,Math.floor(Number(event.target.value)||0))))}/></label>
          <label><input aria-label="Early stopping" type="checkbox" disabled={isTraining} checked={earlyStopping.enabled} onChange={event=>{setEarlyStopping({...earlyStopping,enabled:event.target.checked});setActiveRun(null);setExperimentStatus('Inputs changed');}}/>Stop after 5 validation epochs without improvement (final weights)</label>
          <label className="text-xs text-[#9EACC4]">Optimizer<select aria-label="Optimizer" disabled={isTraining} value={optimizer} onChange={e => setOptimizer(e.target.value)} className="w-full p-2 bg-[#080D18] rounded"><option value="adam">Adam</option><option value="sgd">SGD</option><option value="momentum">Momentum</option></select></label>
          <label className="text-xs text-[#9EACC4]">Batch size<input aria-label="Batch size" type="number" min="1" max="128" disabled={isTraining} value={batchSize} onChange={e => setBatchSize(Math.max(1, Math.min(128, Math.round(Number(e.target.value) || 1))))} className="w-full p-2 bg-[#080D18] rounded" /></label>
          {checkpoints.length > 0 && <label className="text-xs text-[#9EACC4]">Inspect recorded checkpoint
            <select aria-label="Recorded checkpoint" value={scrubberEpoch} disabled={isTraining} onChange={e => restoreCheckpoint(Number(e.target.value))} className="w-full p-2 bg-[#080D18] rounded">
              {checkpoints.map(c => <option key={c.epoch} value={c.epoch}>Epoch {c.epoch}</option>)}
            </select>
          </label>}
          <label className="text-xs text-[#9EACC4]">Learning rate
            <input aria-label="Learning rate" type="number" min="0.001" max="0.5" step="0.001" value={learningRate} disabled={isTraining} onChange={e => setLearningRate(Math.max(0.001, Math.min(0.5, Number(e.target.value) || 0.001)))} className="w-full bg-[#080D18] p-2 rounded" />
          </label>
          <label className="text-xs text-[#9EACC4]">Epochs
            <input aria-label="Epochs" type="number" min="1" max="500" value={totalEpochs} disabled={isTraining} onChange={e => { setTotalEpochs(Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1)))); setActiveRun(null); setExperimentStatus('Inputs changed'); }} className="w-full bg-[#080D18] p-2 rounded" />
          </label>
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
              <span>{isTraining ? 'Stop Training' : 'Train Model (TensorFlow.js)'}</span>
            </button>
            <button
              disabled={isTraining}
              onClick={initModel}
              className="w-full py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-[#9EACC4] hover:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Weights</span>
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

          {/* Context Inspector */}
          <ContextInspector className="mt-3" />
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
              Optimizer: {optimizer} (α={learningRate}) · Batch: {batchSize} · Seeded fixed order
            </span>
          </div>
          <button className="text-[#9EACC4] hover:text-white">
            {bottomDockCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {!bottomDockCollapsed && (
          <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">
            {/* Loss Unified Chart */}
            <UnifiedChart
              title="Binary Cross-Entropy Loss"
              unit="loss"
              trainSeries={lossHistory.map(h => ({ epoch: h.epoch, value: h.loss }))}
              valSeries={lossHistory.map(h => ({ epoch: h.epoch, value: h.valLoss }))}
              height={140}
              colorTrain="#46D7F2"
              chartId="studio-loss"
            />

            {/* Accuracy Unified Chart */}
            <UnifiedChart
              title="Validation Accuracy"
              unit="%"
              trainSeries={accuracyHistory.map(h=>({epoch:h.epoch,value:h.accuracy*100}))}
              valSeries={accuracyHistory.map(h => ({
                epoch: h.epoch,
                value: h.valAccuracy != null ? h.valAccuracy * 100 : null
              }))}
              height={140}
              minVal={0}
              maxVal={100}
              colorVal="#3CD5AA"
              chartId="studio-acc"
            />

            {/* Scientific Verification */}
            <div className="p-3.5 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between font-mono text-xs">
              <div>
                <span className="text-xs font-semibold text-white">XOR Non-Linearity Verification</span>
                <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
                  {layers.length === 2 && selectedDatasetName === 'XOR Problem'
                    ? 'A linear classifier cannot perfectly separate the XOR pattern. Inspect measured validation performance.'
                    : 'Hidden layers can represent nonlinear boundaries. Training and validation measurements determine how well this run learned.'}
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
      <section className="p-4 space-y-4" aria-label="Model investigation">
        {isFeatureEnabled('neural_diagnostics') && modelWeights.length > 0 && <NeuralStudioDiagnostics layers={layers} weightsAndBiases={modelWeights.map(w => ({ weights:w.kernel,biases:w.bias }))} sample={probeInput} batchSamples={trainPoints.map(p => [p.x,p.y])} />}
        {isFeatureEnabled('error_explorer') && evaluationSamples.length > 0 && <ErrorExplorer baselineRunId={currentRunId} samples={evaluationSamples} onSelectSample={sample => setSelectedContext({type:'sample',data:sample})} />}
      </section>
    </div>
  );
}
