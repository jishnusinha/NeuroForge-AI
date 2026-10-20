import ErrorExplorer from '../components/workspace/ErrorExplorer.jsx';
import { isFeatureEnabled, validateExecutionBudget } from '../services/productionConfig.js';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Play,
  RotateCcw,
  Pencil,
  Eraser,
  MousePointer,
  Search,
  Move,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  StepForward,
  FastForward
} from 'lucide-react';
import InteractiveCanvas from '../components/InteractiveCanvas';
import {
  generateTwoMoons,
  generateXOR,
  generateConcentricCircles,
  generateGaussianBlobs,
  generateLinearTrend,
  generateSpiral,
  trainTestSplit
} from '../ml/datasets';
import { solveOLS, trainLinearRegressionGD } from '../ml/linearRegression';
import { trainLogisticRegression } from '../ml/logisticRegression';
import { createKNN } from '../ml/knn';
import { runKMeans, stepKMeans, initializeCentroids } from '../ml/kmeans';
import { useLabStore } from '../store/useLabStore';
import { fingerprint } from '../ml/experiments';
import { useHistory } from '../store/useHistory';
import { useNavigate } from 'react-router-dom';
import ContextInspector from '../components/workspace/ContextInspector';
import { draftManager } from '../services/draftManager';


export default function PlaygroundShell() {
  const currentRunId = useLabStore(state=>state.activeRun?.runId || 'unsaved-inspection');
  const {
    setExperimentStatus,
    setActiveRun,
    pendingRun,
    clearPendingRun,
    loadRun,
    showToast,
    viewMode: workspaceViewMode,
    setSelectedContext
  } = useLabStore();
  const navigate = useNavigate();
  const initialRun = pendingRun?.workspace === 'playground' ? pendingRun : null;
  const hp = initialRun?.hyperparameters || {};
  const draftIdentity = useRef({ id: initialRun?._draftId || crypto.randomUUID(), baseRevision: initialRun?._draftRevision ?? 0 });


  // Dataset State
  const [selectedPreset, setSelectedPreset] = useState(initialRun?.dataset.name || 'Two Moons');
  const [noiseLevel, setNoiseLevel] = useState((initialRun?.dataset.noise ?? .2) * 100);
  const [trainRatio, setTrainRatio] = useState(initialRun?.dataset.trainRatio ?? 0.8);
  const [rawPoints, setRawPoints, undoPoints, redoPoints, canUndo, canRedo] = useHistory(() => initialRun?.dataset.points || generateTwoMoons(220,.2,42));
  const [preparedSource] = useState(() => initialRun?.dataset.preparation ? { points:JSON.stringify(initialRun.dataset.points), preparation:initialRun.dataset.preparation, preprocessing:initialRun.dataset.preprocessing } : null);
  const preparation = useMemo(() => preparedSource?.points === JSON.stringify(rawPoints) ? preparedSource.preparation : null,[preparedSource,rawPoints]);
  const [testResult,setTestResult] = useState(null);
  const [testAccessHistory,setTestAccessHistory] = useState([]);
  const [explicitStale, setIsStale] = useState(false);
  const [resultKey, setResultKey] = useState(null);

  // Tools & Canvas State
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'draw' | 'erase' | 'inspect' | 'pan'
  const [drawClass, setDrawClass] = useState(0); // 0 or 1
  const [probePoint, setProbePoint] = useState(null);

  // Model & Hyperparameters State
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(initialRun?.algorithm || 'Logistic Regression');
  const [regressionMethod, setRegressionMethod] = useState(hp.method ?? 'ols');
  const [learningRate, setLearningRate] = useState(hp.learningRate ?? 0.08);
  const [regularization, setRegularization] = useState(hp.regularization ?? 0.001);
  const [threshold, setThreshold] = useState(hp.threshold ?? 0.5);
  const [knnK, setKnnK] = useState(hp.k ?? 5);
  const [knnMetric, setKnnMetric] = useState(hp.metric ?? 'euclidean');
  const [knnWeighted, setKnnWeighted] = useState(hp.weighted ?? false);
  const [kMeansClusters, setKMeansClusters] = useState(hp.k ?? 3);
  const [kCentroids, setKCentroids] = useState(hp.initialCentroids || []);
  const [kMeansIteration, setKMeansIteration] = useState(0);

  // Solved Model Results
  const [modelResult, setModelResult] = useState(null);
  const [bottomDockCollapsed, setBottomDockCollapsed] = useState(false);
  const [showMetricHistoryTable, setShowMetricHistoryTable] = useState(false);
  // Results belong to the exact input snapshot, including edits restored by undo.
  const configKey = useMemo(() => JSON.stringify({ rawPoints, trainRatio, selectedPreset, selectedAlgorithm,
    regressionMethod, learningRate, regularization, threshold, knnK, knnMetric, knnWeighted, kMeansClusters }),
  [rawPoints, trainRatio, selectedPreset, selectedAlgorithm, regressionMethod, learningRate, regularization, threshold, knnK, knnMetric, knnWeighted, kMeansClusters]);
  const isStale = explicitStale || resultKey !== configKey;

  // Sync probe selection to ContextInspector
  useEffect(() => {
    if (probePoint) {
      setSelectedContext({
        type: 'sample',
        data: {
          id: probePoint.id ?? 'Probe Point',
          x1: probePoint.x,
          x2: probePoint.y,
          prediction: probePoint.predictedClass,
          label: probePoint.trueClass ?? probePoint.label,
          split: probePoint.split,
          residual: probePoint.residual
        }
      });
    }
  }, [probePoint, setSelectedContext]);

  useEffect(() => {
    if (!isFeatureEnabled('durable_drafts')) return;
    draftManager.queueAutosave({ ...draftIdentity.current, workspace: 'playground', configuration: {
      workspace: 'playground', algorithm: selectedAlgorithm,
      dataset: { name: selectedPreset, points: rawPoints, noise: noiseLevel / 100, trainRatio, seed: preparation ? null : 42, preparation, preprocessing: preparation ? preparedSource.preprocessing : 'none' },
      hyperparameters: { method: regressionMethod, learningRate, regularization, threshold, k: selectedAlgorithm === 'K-Means Clustering' ? kMeansClusters : knnK, metric: knnMetric, weighted: knnWeighted, initialCentroids: kCentroids },
    } });
  }, [selectedAlgorithm, selectedPreset, rawPoints, noiseLevel, trainRatio, regressionMethod, learningRate, regularization, threshold, knnK, knnMetric, knnWeighted, kMeansClusters, kCentroids, preparation, preparedSource]);

  // Generate initial dataset
  const generateDataset = useCallback((preset, noise) => {
    const n = 220;
    const noiseNorm = noise / 100;
    let pts = [];

    switch (preset) {
      case 'Two Moons':
        pts = generateTwoMoons(n, noiseNorm);
        break;
      case 'XOR Problem':
        pts = generateXOR(n, noiseNorm);
        break;
      case 'Concentric Circles':
        pts = generateConcentricCircles(n, noiseNorm);
        break;
      case 'Gaussian Blobs':
        pts = generateGaussianBlobs(n, noiseNorm);
        break;
      case 'Linear Trend':
        pts = generateLinearTrend(120, noiseNorm);
        break;
      case 'Spiral':
        pts = generateSpiral(n, noiseNorm);
        break;
      default:
        pts = generateTwoMoons(n, noiseNorm);
    }
    setRawPoints(pts);
    setKCentroids([]); setKMeansIteration(0);
    setIsStale(true);
  }, [setRawPoints]);

  useEffect(() => { clearPendingRun(); }, [clearPendingRun]);

  // Split into train/test
  const { train: trainPoints, test: testPoints, heldOut: heldOutPoints = [], all: allPoints } = useMemo(() => {
    return trainTestSplit(rawPoints, trainRatio, preparation?.seed ?? 42, preparation?.membership);
  }, [rawPoints, trainRatio, preparation]);

  // Solver execution
  const executeSolver = useCallback(() => {
    if (!trainPoints || trainPoints.length < 2 || trainPoints.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      showToast('Add at least two finite data points before running.', 'error'); return;
    }
    if (['Logistic Regression', 'K-Nearest Neighbors (KNN)'].includes(selectedAlgorithm) &&
      (allPoints.some(p => ![0, 1].includes(p.label)) || new Set(trainPoints.map(p => p.label)).size < 2 || selectedPreset === 'Linear Trend')) {
      showToast('Choose a binary classification dataset with both classes.', 'error'); return;
    }

    validateExecutionBudget(rawPoints.length,2);
    setTestResult(null);
    setResultKey(configKey);
    setExperimentStatus('Running');
    try {
    if (selectedAlgorithm === 'Linear Regression') {
      const res = regressionMethod === 'gd' ? trainLinearRegressionGD(trainPoints, testPoints, learningRate, 90) : solveOLS(trainPoints, testPoints);
      setModelResult(res);
      setIsStale(false);
      setExperimentStatus('Completed');
      showToast(`Linear fit: R² = ${res.r2}, MSE = ${res.mse}`, 'success');
    } else if (selectedAlgorithm === 'Logistic Regression') {
      const res = trainLogisticRegression(trainPoints, testPoints, learningRate, regularization, 90, threshold);
      setModelResult(res);
      setIsStale(false);
      setExperimentStatus('Completed');
      showToast(`Logistic fit: Test Accuracy = ${(res.testAccuracy * 100).toFixed(1)}%`, 'success');
    } else if (selectedAlgorithm === 'K-Nearest Neighbors (KNN)') {
      const knn = createKNN(trainPoints, knnK, knnMetric, knnWeighted);
      const testAcc = knn.evaluate(testPoints);
      setModelResult({
        ...knn,
        testAccuracy: testAcc,
      });
      setIsStale(false);
      setExperimentStatus('Completed');
      showToast(`KNN (k=${knnK}): Test Accuracy = ${(testAcc * 100).toFixed(1)}%`, 'success');
    } else if (selectedAlgorithm === 'K-Means Clustering') {
      const initC = kCentroids.length === kMeansClusters ? kCentroids : initializeCentroids(allPoints, kMeansClusters, 42);
      setKCentroids(initC);
      const res = runKMeans(allPoints, kMeansClusters, initC, 15);
      setKCentroids(res.finalCentroids);
      setKMeansIteration(res.iterations);
      setModelResult({ ...res, initialCentroids: initC });
      setIsStale(false);
      setExperimentStatus('Completed');
      if (!res.converged) setExperimentStatus('Ready');
      showToast(`K-Means: ${res.iterations} iterations (Inertia: ${res.finalInertia})`, 'success');
    }
    } catch (error) { setActiveRun(null); setIsStale(true); setExperimentStatus('Failed'); showToast(error.message,'error'); }
  }, [
    rawPoints,
    trainPoints,
    testPoints,
    allPoints,
    selectedAlgorithm,
    selectedPreset,
    regressionMethod,
    learningRate,
    regularization,
    threshold,
    knnK,
    knnMetric,
    knnWeighted,
    kMeansClusters,
    kCentroids,
    configKey,
    setExperimentStatus,
    setActiveRun,
    showToast,
  ]);

  useEffect(() => {
    if (isStale) { setExperimentStatus('Inputs changed'); setActiveRun(null); }
  }, [isStale, setExperimentStatus, setActiveRun]);

  useEffect(() => {
    if (!modelResult || isStale) return;
    setActiveRun({ workspace: 'playground', task: selectedAlgorithm === 'Linear Regression' ? 'regression' : selectedAlgorithm === 'K-Means Clustering' ? 'clustering' : 'classification',
      name: `${selectedPreset} — ${selectedAlgorithm}`, algorithm: selectedAlgorithm,
      evaluation: { splitSeed: preparation?.seed ?? 42, testAccessHistory, membership: selectedAlgorithm === 'K-Means Clustering' ? {train:rawPoints.map(p=>String(p.id)),validation:[],test:[]} : preparation?.membership || { train: rawPoints.filter(p=>!testPoints.some(t=>t.id===p.id)).map(p=>String(p.id)),validation:testPoints.map(p=>String(p.id)),test:[] } },
      dataset: { name: selectedPreset, points: rawPoints, sampleCount: rawPoints.length, noise: noiseLevel / 100, trainRatio, seed: preparation ? null : 42, preparation,
        fingerprint: fingerprint(rawPoints), splitFingerprint: fingerprint(testPoints), preprocessing: preparation ? preparedSource.preprocessing : 'none' },
      hyperparameters: { learningRate, method: regressionMethod, regularization, threshold, k: selectedAlgorithm === 'K-Means Clustering' ? kMeansClusters : knnK, metric: knnMetric, weighted: knnWeighted, initialCentroids: modelResult.initialCentroids },
      metrics: { mse: modelResult.mse, r2: modelResult.r2, testMse: modelResult.testMse, valAccuracy: modelResult.testAccuracy,
        trainAccuracy: modelResult.accuracy, trainLoss: modelResult.history?.at(-1)?.trainLoss, valLoss: modelResult.history?.at(-1)?.valLoss,
        inertia: modelResult.finalInertia ?? modelResult.inertia, iterations: kMeansIteration, confusion: modelResult.confusion },
      metricHistory: (modelResult.history || []).map(h => ({ ...h, epoch: h.epoch ?? h.iteration, loss: h.trainLoss ?? h.inertia })), status: 'Completed' });
    setExperimentStatus(modelResult.converged === false ? 'Ready' : 'Completed');
  }, [modelResult, isStale, rawPoints, trainRatio, selectedAlgorithm, regressionMethod, selectedPreset, noiseLevel, learningRate, regularization, threshold, knnK, knnMetric, knnWeighted, kMeansClusters, kMeansIteration, testPoints, preparation, preparedSource, testAccessHistory, setActiveRun, setExperimentStatus]);

  // Point modifications
  const handleAddPoint = (newPt) => {
    if (rawPoints.length >= 2000) { showToast('This lab supports up to 2,000 points. Remove points before adding more.','error'); return; }
    setRawPoints((prev) => [...prev, newPt]);
    setIsStale(true);
    setExperimentStatus('Inputs changed');
  };

  const handleUpdatePoint = (id, newX, newY) => {
    setRawPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, x: newX, y: newY } : p))
    );
    setIsStale(true);
    setExperimentStatus('Inputs changed');
  };

  const handleDeletePoint = (id) => {
    setRawPoints((prev) => prev.filter((p) => p.id !== id));
    setIsStale(true);
    setExperimentStatus('Inputs changed');
  };

  const handleProbe = (mx, my) => {
    if (selectedAlgorithm === 'K-Nearest Neighbors (KNN)' && modelResult?.probe) {
      const pResult = modelResult.probe(mx, my);
      setProbePoint(pResult);
      showToast(`Probe (${mx}, ${my}): Class ${pResult.predictedClass} (Vote: ${(pResult.confidence * 100).toFixed(0)}%)`, 'info');
    } else if (selectedAlgorithm === 'Logistic Regression' && modelResult?.predictProbability) {
      const prob = modelResult.predictProbability(mx, my);
      showToast(`Probe (${mx}, ${my}): P(y=1) = ${(prob * 100).toFixed(1)}%`, 'info');
    }
  };

  // K-Means Step-by-Step
  const handleStepKMeans = () => {
    if (selectedAlgorithm !== 'K-Means Clustering') return;
    if (allPoints.length < 2) { showToast('Add at least two points.', 'error'); return; }
    const currentC = kCentroids.length > 0 ? kCentroids : initializeCentroids(allPoints, kMeansClusters);
    const stepRes = stepKMeans(allPoints, currentC);
    setResultKey(configKey);
    setKCentroids(stepRes.centroids);
    setKMeansIteration((prev) => prev + 1);
    setModelResult({ ...stepRes, initialCentroids: currentC });
    setIsStale(false);
    showToast(`Step ${kMeansIteration + 1}: Inertia = ${stepRes.inertia} ${stepRes.converged ? '(Converged!)' : ''}`, 'info');
  };

  const handleCentroidDrag = (idx, newX, newY) => {
    setKCentroids((prev) => {
      const updated = [...prev];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], x: newX, y: newY };
      }
      return updated;
    });
    setIsStale(true);
  };

  const presets = ['Two Moons', 'XOR Problem', 'Concentric Circles', 'Gaussian Blobs', 'Linear Trend', 'Spiral'];

  return (
    <div className="lab-workspace min-w-0 flex-1 flex flex-col min-h-[calc(100vh-64px)]">
      {/* Upper 3-Panel Grid */}
      <div className="flex min-w-0 min-h-[620px] overflow-hidden">

        {/* Left: Dataset Setup Panel */}
        <aside className="w-[260px] bg-[#151E30] border-r border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#46D7F2] font-semibold">
              01 • Dataset Setup
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">2D Synthetic Generators</h3>
          </div>

          {/* Presets List */}
          <div className="space-y-1">
            <label className="text-xs text-[#9EACC4] font-medium">Dataset Preset</label>
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setSelectedPreset(preset);
                  generateDataset(preset, noiseLevel);
                  if (preset === 'Linear Trend') setSelectedAlgorithm('Linear Regression');
                  else if (preset === 'Gaussian Blobs') setSelectedAlgorithm('K-Means Clustering');
                  else if (selectedAlgorithm === 'Linear Regression') setSelectedAlgorithm('Logistic Regression');
                }}
                className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedPreset === preset
                    ? 'bg-[#46D7F2]/15 text-[#46D7F2] border border-[#46D7F2]/40 shadow-sm'
                    : 'text-[#9EACC4] hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <div className="flex gap-2 text-xs"><button disabled={!canUndo} onClick={undoPoints} className="p-2 bg-white/10 rounded disabled:opacity-30">Undo data edit</button><button disabled={!canRedo} onClick={redoPoints} className="p-2 bg-white/10 rounded disabled:opacity-30">Redo</button></div>
          {selectedPreset !== 'Linear Trend' && rawPoints.length > 0 && rawPoints.every(p => [0,1].includes(p.label)) && <button className="text-xs p-2 bg-violet-400/20 rounded" onClick={() => {
            loadRun({workspace:'studio', dataset:{name:selectedPreset, points:rawPoints, noise:noiseLevel/100, trainRatio, seed:42}, hyperparameters:{layers:[{id:'in',type:'Input',units:2,activation:'Linear'},{id:'hidden',type:'Dense',units:4,activation:'ReLU'},{id:'out',type:'Output',units:1,activation:'Sigmoid'}]}});
            navigate('/app/studio');
          }}>Open this dataset in Studio</button>}
          <div className="pt-2 border-t border-white/5 space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#9EACC4]">Gaussian Noise</span>
                <span className="font-mono text-white text-xs">{noiseLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={noiseLevel}
                onChange={(e) => {
                  setNoiseLevel(Number(e.target.value));
                  generateDataset(selectedPreset, Number(e.target.value));
                  setIsStale(true);
                }}
                className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#46D7F2]"
              />
            </div>

            {selectedAlgorithm !== 'K-Means Clustering' && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#9EACC4]">Train / Test Split</span>
                  <span className="font-mono text-white text-xs">{(trainRatio * 100).toFixed(0)}% / {((1 - trainRatio) * 100).toFixed(0)}%</span>
                </div>
                <input
                  aria-label="Train ratio"
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={trainRatio * 100}
                  onChange={(e) => {
                    setTrainRatio(Number(e.target.value) / 100);
                    setIsStale(true);
                  }}
                  className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#3CD5AA]"
                />
              </div>
            )}
          </div>

          {/* Draw Class Picker (when Draw Tool active) */}
          {activeTool === 'draw' && (
            <div className="p-3 rounded-xl bg-[#080D18] border border-[#46D7F2]/30 space-y-2">
              <span className="text-[11px] font-mono text-[#9EACC4]">Click canvas to place:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setDrawClass(0)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    drawClass === 0 ? 'bg-[#46D7F2] text-[#080D18]' : 'bg-white/5 text-[#46D7F2] border border-[#46D7F2]/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  Class A (0)
                </button>
                <button
                  onClick={() => setDrawClass(1)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    drawClass === 1 ? 'bg-[#A78BFA] text-[#080D18]' : 'bg-white/5 text-[#A78BFA] border border-[#A78BFA]/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  Class B (1)
                </button>
              </div>
            </div>
          )}

          {/* Dataset Metrics */}
          <div className="p-3 rounded-xl bg-[#080D18] border border-white/5 text-[11px] font-mono space-y-1">
            <div className="flex justify-between text-[#9EACC4]">
              <span>Total Points:</span>
              <span className="text-white font-bold">{allPoints.length}</span>
            </div>
            <div className="flex justify-between text-[#9EACC4]">
              <span>Train / Test:</span>
              <span className="text-[#3CD5AA]">{trainPoints.length} / {testPoints.length}</span>
            </div>
            <div className="flex justify-between text-[#9EACC4]">
              <span>Coordinate Range:</span>
              <span className="text-[#46D7F2]">[-2.5, 2.5]</span>
            </div>
          </div>

          <button
            onClick={() => {
              generateDataset(selectedPreset, noiseLevel);
              showToast('Reset dataset seed.', 'info');
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#9EACC4] hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Regenerate Points</span>
          </button>
        </aside>

        {/* Center: Interactive Canvas */}
        <section className="flex-1 min-w-0 flex flex-col bg-[#080D18] relative overflow-hidden">

          {/* Floating Canvas Toolbar */}
          <div role="toolbar" aria-label="Dataset canvas tools" className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex items-center gap-1 p-1 rounded-xl bg-[#151E30]/90 backdrop-blur-md border border-white/10 shadow-lg">
            {[
              { id: 'select', icon: MousePointer, label: 'Select / Drag Points' },
              { id: 'draw', icon: Pencil, label: 'Draw New Points' },
              { id: 'erase', icon: Eraser, label: 'Click to Erase Points' },
              { id: 'inspect', icon: Search, label: 'Probe Region & Confidence' },
              { id: 'pan', icon: Move, label: 'Pan / Zoom Grid' },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  aria-label={tool.label}
                  aria-pressed={activeTool === tool.id}
                  className={`min-w-9 min-h-9 p-2 rounded-lg text-xs font-medium transition-all ${
                    activeTool === tool.id
                      ? 'bg-[#46D7F2]/20 text-[#46D7F2] border border-[#46D7F2]/40 shadow-sm'
                      : 'text-[#9EACC4] hover:text-white hover:bg-white/5'
                  }`}
                  title={tool.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Stale Result Alert if user mutated data */}
          {isStale && (
            <div className="absolute top-14 right-2 left-2 sm:left-auto sm:top-4 sm:right-4 z-20 flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F3B65E]/15 border border-[#F3B65E]/40 text-[#F3B65E] text-xs font-medium backdrop-blur-md shadow-lg animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Inputs changed: Boundary is stale reference.</span>
              <button
                onClick={executeSolver}
                className="ml-2 px-2.5 py-0.5 rounded-lg bg-[#F3B65E] hover:opacity-90 text-[#080D18] font-bold text-[11px] shadow-sm transition-opacity"
              >
                Recalculate
              </button>
            </div>
          )}

          {/* Canvas Engine */}
          <div className="flex-1 w-full h-full">
            <InteractiveCanvas
              points={selectedAlgorithm === 'K-Means Clustering' ? (modelResult?.labeledPoints || modelResult?.points || allPoints) : allPoints}
              testPoints={testPoints}
              algorithm={selectedAlgorithm}
              modelResult={modelResult}
              isStale={isStale}
              activeTool={activeTool}
              drawClass={drawClass}
              probePoint={probePoint}
              onAddPoint={handleAddPoint}
              onUpdatePoint={handleUpdatePoint}
              onDeletePoint={handleDeletePoint}
              onProbe={handleProbe}
              onCentroidDrag={handleCentroidDrag}
              kCentroids={kCentroids}
            />
          </div>
        </section>

        {/* Right: Model Controls & Real-Time Parameters */}
        <aside className="w-[320px] bg-[#151E30] border-l border-white/10 flex flex-col p-4 overflow-y-auto space-y-4 flex-shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A78BFA] font-semibold">
              02 • Model Controls
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5">Algorithm Configuration</h3>
          </div>

          {/* Algorithm Picker */}
          <div className="space-y-1">
            <label className="text-xs text-[#9EACC4] font-medium">Selected Algorithm</label>
            <select
              value={selectedAlgorithm}
              onChange={(e) => {
                setSelectedAlgorithm(e.target.value);
                setProbePoint(null);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#080D18] border border-white/10 text-xs text-white focus:outline-none focus:border-[#46D7F2]"
            >
              <option value="Logistic Regression">Logistic Regression (Sigmoid Line)</option>
              <option value="Linear Regression">Linear Regression (OLS / GD)</option>
              <option value="K-Nearest Neighbors (KNN)">K-Nearest Neighbors (KNN)</option>
              <option value="K-Means Clustering">K-Means Clustering (Voronoi)</option>
            </select>
          </div>

          {/* Algorithm-Specific Parameter Sliders */}
          <div className="space-y-3.5 pt-2 border-t border-white/5">
            {selectedAlgorithm === 'Logistic Regression' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9EACC4]">Learning Rate (α)</span>
                    <span className="font-mono text-white text-xs">{learningRate}</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.5"
                    step="0.01"
                    value={learningRate}
                    onChange={(e) => {
                      setLearningRate(Number(e.target.value));
                      setIsStale(true);
                    }}
                    className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#A78BFA]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9EACC4]">L2 Regularization (λ)</span>
                    <span className="font-mono text-white text-xs">{regularization}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.05"
                    step="0.002"
                    value={regularization}
                    onChange={(e) => {
                      setRegularization(Number(e.target.value));
                      setIsStale(true);
                    }}
                    className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#A78BFA]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9EACC4]">Decision Threshold</span>
                    <span className="font-mono text-[#3CD5AA] text-xs">{threshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => {
                      setThreshold(Number(e.target.value));
                      setIsStale(true);
                    }}
                    className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#3CD5AA]"
                  />
                </div>
              </>
            )}

            {selectedAlgorithm === 'Linear Regression' && (
              <div className="p-3 rounded-xl bg-[#080D18] border border-white/5 space-y-1.5 text-xs font-mono">
                <label>Solver<select aria-label="Regression solver" className="block w-full bg-[#151E30] p-2" value={regressionMethod} onChange={e => setRegressionMethod(e.target.value)}><option value="ols">Ordinary least squares</option><option value="gd">Gradient descent</option></select></label>
                {regressionMethod === 'gd' && <label>Learning rate<input aria-label="Regression learning rate" type="range" min="0.001" max="0.5" step="0.001" value={learningRate} onChange={e => setLearningRate(Number(e.target.value))} />{learningRate}</label>}
                <div className="flex justify-between text-[#9EACC4]">
                  <span>Fitted Slope (w):</span>
                  <span className="text-[#46D7F2] font-bold">{modelResult?.slope ?? 'Not fitted'}</span>
                </div>
                <div className="flex justify-between text-[#9EACC4]">
                  <span>Intercept (b):</span>
                  <span className="text-white font-bold">{modelResult?.intercept ?? 'Not fitted'}</span>
                </div>
                <div className="flex justify-between text-[#9EACC4]">
                  <span>Formula:</span>
                  <span className="text-[#3CD5AA]">{modelResult?.slope != null ? `y = ${modelResult.slope}x + ${modelResult.intercept}` : 'Run the model to fit a line'}</span>
                </div>
              </div>
            )}

            {selectedAlgorithm === 'K-Nearest Neighbors (KNN)' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9EACC4]">Neighbors (k)</span>
                    <span className="font-mono text-[#46D7F2] text-xs">{knnK}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="21"
                    step="2"
                    value={knnK}
                    onChange={(e) => {
                      setKnnK(Number(e.target.value));
                      setIsStale(true);
                    }}
                    className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#46D7F2]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-[#9EACC4]">Distance Metric</label>
                  <select
                    value={knnMetric}
                    onChange={(e) => {
                      setKnnMetric(e.target.value);
                      setIsStale(true);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#080D18] border border-white/10 text-xs text-white"
                  >
                    <option value="euclidean">Euclidean (L2 Norm)</option>
                    <option value="manhattan">Manhattan (L1 Norm)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#9EACC4]">Distance Weighting</span>
                  <input
                    type="checkbox"
                    checked={knnWeighted}
                    onChange={(e) => {
                      setKnnWeighted(e.target.checked);
                      setIsStale(true);
                    }}
                    className="w-4 h-4 accent-[#46D7F2] rounded cursor-pointer"
                  />
                </div>
              </>
            )}

            {selectedAlgorithm === 'K-Means Clustering' && (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9EACC4]">Clusters (k)</span>
                    <span className="font-mono text-[#3CD5AA] text-xs">{kMeansClusters}</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="5"
                    value={kMeansClusters}
                    onChange={(e) => {
                      const newK = Number(e.target.value);
                      setKMeansClusters(newK);
                      const initC = initializeCentroids(allPoints, newK, 42);
                      setKCentroids(initC);
                      setIsStale(true);
                    }}
                    className="w-full h-1.5 bg-[#202B43] rounded-lg appearance-none cursor-pointer accent-[#3CD5AA]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleStepKMeans}
                    className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all"
                  >
                    <StepForward className="w-3.5 h-3.5 text-[#46D7F2]" />
                    <span>Step Iteration</span>
                  </button>
                  <button
                    onClick={executeSolver}
                    className="py-2 px-3 rounded-xl bg-[#3CD5AA]/15 hover:bg-[#3CD5AA]/25 border border-[#3CD5AA]/30 text-xs font-semibold text-[#3CD5AA] flex items-center justify-center gap-1.5 transition-all"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Converge</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={executeSolver}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] hover:opacity-95 text-[#080D18] font-bold text-xs flex items-center justify-center gap-2 shadow-glow-cyan transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Recalculate Model Boundary</span>
          </button>

          {/* Model Mathematical Formulation Card */}
          <div className="p-3 rounded-xl bg-[#0D1422] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Info className="w-3.5 h-3.5 text-[#46D7F2]" />
              <span>Scientific Formulation</span>
            </div>
            {selectedAlgorithm === 'Logistic Regression' && (
              <p className="text-[11px] text-[#9EACC4] leading-relaxed">
                Computes non-linear probability via Sigmoid. Decision boundary line exists where <code className="text-[#46D7F2]">w₁x₁ + w₂x₂ + b = 0</code>.
              </p>
            )}
            {selectedAlgorithm === 'Linear Regression' && (
              <p className="text-[11px] text-[#9EACC4] leading-relaxed">
                Minimizes sum of squared residuals via analytical closed-form Ordinary Least Squares.
              </p>
            )}
            {selectedAlgorithm === 'K-Nearest Neighbors (KNN)' && (
              <p className="text-[11px] text-[#9EACC4] leading-relaxed">
                Non-parametric local voting based on top-{knnK} nearest coordinate distances. Click canvas with "Inspect" to cast voting rays.
              </p>
            )}
            {selectedAlgorithm === 'K-Means Clustering' && (
              <p className="text-[11px] text-[#9EACC4] leading-relaxed">
                Iteratively updates Voronoi partition centers by minimizing within-cluster inertia sum of squares. Drag centroids to inspect cluster re-assignment!
              </p>
            )}
          </div>

          {/* Guided View Insights */}
          {workspaceViewMode === 'guided' && (
            <div className="p-3 rounded-xl bg-[#46D7F2]/10 border border-[#46D7F2]/20 text-xs text-[#9EACC4] space-y-1 font-mono">
              <span className="font-semibold text-[#46D7F2] block">Guided Algorithm Insight</span>
              <p className="text-[11px] leading-relaxed">
                {selectedAlgorithm === 'Logistic Regression' && 'Draw points or adjust noise to see how the linear boundary separates the classes.'}
                {selectedAlgorithm === 'Linear Regression' && 'Add or move points to observe how the best-fitting slope and intercept adapt.'}
                {selectedAlgorithm === 'K-Nearest Neighbors (KNN)' && 'Use the Inspect tool to query any point on the canvas and view its K closest neighbors.'}
                {selectedAlgorithm === 'K-Means Clustering' && 'Click Step Iteration to watch cluster centroids move towards the center of each group.'}
              </p>
            </div>
          )}

          {/* Context Inspector */}
          <ContextInspector className="mt-1" />
        </aside>
      </div>


      {/* Bottom: Analysis & Metrics Dock */}
      <footer
        className={`bg-[#0D1422] border-t border-white/10 transition-all duration-300 flex flex-col flex-shrink-0 ${
          bottomDockCollapsed ? 'h-9' : 'h-52'
        }`}
      >
        <button type="button"
          onClick={() => setBottomDockCollapsed(value => !value)}
          aria-expanded={!bottomDockCollapsed}
          aria-label={bottomDockCollapsed ? 'Expand Playground analysis' : 'Collapse Playground analysis'}
          className="w-full min-h-9 px-4 bg-[#151E30]/70 flex items-center justify-between text-left cursor-pointer border-b border-white/5 hover:bg-[#151E30]"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3CD5AA]" />
              Empirical Metrics Timeline & Error Analysis
            </span>
          </div>
          <span aria-hidden="true" className="text-[#9EACC4]">
            {bottomDockCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {!bottomDockCollapsed && (isStale ? <p role="status" className="p-4 text-sm text-[#9EACC4]">No current measurements. Run the model to evaluate these inputs.</p> : (
          <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">

            {/* Metric 1: Loss or Residuals */}
            <div className="p-3 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9EACC4]">
                  {selectedAlgorithm === 'Linear Regression' ? 'Mean Squared Error (MSE)' :
                   selectedAlgorithm === 'K-Means Clustering' ? 'Cluster Inertia (J)' : 'Binary Cross-Entropy Loss'}
                </span>
                <span className="font-mono text-[#46D7F2] font-semibold">
                  {selectedAlgorithm === 'Linear Regression' ? modelResult?.mse :
                   selectedAlgorithm === 'K-Means Clustering' ? (modelResult?.finalInertia || modelResult?.inertia || 0) :
                   modelResult?.history?.[modelResult.history.length - 1]?.trainLoss ?? 'Not available'}
                </span>
              </div>
              <button type="button" aria-pressed={showMetricHistoryTable}
                onClick={() => setShowMetricHistoryTable(value => !value)}
                className="self-start mt-2 rounded border border-cyan-400/30 px-2 py-1 text-[11px] text-cyan-200 hover:bg-white/10">
                {showMetricHistoryTable ? 'Show history chart' : 'Show history data table'}
              </button>
              {showMetricHistoryTable ? (
                <div role="region" aria-label="Recorded Playground metric history" tabIndex={0} className="max-h-32 overflow-auto mt-2">
                  <table className="w-full text-left text-[11px]">
                    <caption className="sr-only">Exact recorded training history, without inferred values</caption>
                    <thead><tr><th scope="col" className="p-1">Epoch/step</th><th scope="col" className="p-1">Recorded loss/inertia</th></tr></thead>
                    <tbody>{modelResult?.history?.length
                      ? modelResult.history.map((h, idx) => {
                        const value = h.trainLoss ?? h.inertia;
                        return <tr key={idx} className="border-t border-white/10">
                          <th scope="row" className="p-1">{h.epoch ?? h.iteration ?? idx}</th>
                          <td className="p-1 tabular-nums">{Number.isFinite(value) ? value.toFixed(4) : 'Not recorded'}</td>
                        </tr>;
                      })
                      : <tr><td colSpan={2} className="p-1">No iterative history recorded</td></tr>}
                    </tbody>
                  </table>
                </div>
              ) : <div className="h-24 flex items-end gap-1.5 pt-2">
                {modelResult?.history && modelResult.history.length > 0 ? (
                  modelResult.history.slice(-10).map((h, idx) => (
                    <div key={idx} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                      <div
                        className="w-full bg-[#46D7F2]/60 hover:bg-[#46D7F2] rounded-t transition-all"
                        style={{ height: `${(h.trainLoss ?? h.inertia ?? 0) / Math.max(1e-9,...modelResult.history.map(row => row.trainLoss ?? row.inertia ?? 0)) * 80}%` }}
                      />
                      <span className="text-[9px] font-mono text-[#9EACC4]">{h.epoch || h.iteration || idx}</span>
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[#9EACC4]">
                    {selectedAlgorithm === 'Linear Regression' ? 'Closed-form solution computed' : 'No iterative history for this result'}
                  </div>
                )}
              </div>}
            </div>

            {/* Metric 2: Accuracy / R2 / Iterations */}
            <div className="p-3 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9EACC4]">
                  {selectedAlgorithm === 'Linear Regression' ? 'Goodness of Fit (R² Score)' :
                   selectedAlgorithm === 'K-Means Clustering' ? 'Completed Iterations' : 'Test Set Accuracy'}
                </span>
                <span className="font-mono text-[#3CD5AA] font-semibold">
                  {selectedAlgorithm === 'Linear Regression' ? `${((modelResult?.r2 || 0) * 100).toFixed(1)}%` :
                   selectedAlgorithm === 'K-Means Clustering' ? `${kMeansIteration} steps` :
                   `${((modelResult?.testAccuracy || 0) * 100).toFixed(1)}%`}
                </span>
              </div>

              {selectedAlgorithm === 'Logistic Regression' && modelResult?.confusion ? (
                /* Confusion Matrix Display */
                <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono py-1">
                  <div className="p-1.5 rounded bg-[#46D7F2]/10 border border-[#46D7F2]/20">
                    <span className="text-[9px] text-[#9EACC4] block">True 0 (TN)</span>
                    <strong className="text-white">{modelResult.confusion.tn}</strong>
                  </div>
                  <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-[9px] text-[#9EACC4] block">False 1 (FP)</span>
                    <strong className="text-red-400">{modelResult.confusion.fp}</strong>
                  </div>
                  <div className="p-1.5 rounded bg-red-500/10 border border-red-500/20">
                    <span className="text-[9px] text-[#9EACC4] block">False 0 (FN)</span>
                    <strong className="text-red-400">{modelResult.confusion.fn}</strong>
                  </div>
                  <div className="p-1.5 rounded bg-[#A78BFA]/10 border border-[#A78BFA]/20">
                    <span className="text-[9px] text-[#9EACC4] block">True 1 (TP)</span>
                    <strong className="text-white">{modelResult.confusion.tp}</strong>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded bg-black/30 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-[#9EACC4]">
                    <span>Sample Size:</span>
                    <span className="text-white">{allPoints.length} points</span>
                  </div>
                  <div className="flex justify-between text-[#9EACC4]">
                    <span>Evaluation Protocol:</span>
                    <span className="text-[#3CD5AA]">{selectedAlgorithm === 'K-Means Clustering' ? 'Full dataset clustering' : 'Train/Test Isolated'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Metric 3: Scientific Interpretation */}
            <div className="p-3.5 rounded-xl bg-[#151E30] border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Generalization Analysis</span>
                <p className="mt-1 text-xs text-[#9EACC4] leading-relaxed">
                  {selectedPreset === 'XOR Problem' && selectedAlgorithm === 'Logistic Regression'
                    ? 'Expected Failure: The single linear hyperplane fails to separate the diagonal XOR classes, proving the necessity of multi-layer architectures.'
                    : selectedAlgorithm === 'Linear Regression'
                    ? `Ordinary Least Squares accounts for ${((modelResult?.r2 || 0) * 100).toFixed(1)}% of total target variance.`
                    : isStale ? 'Inputs changed. Run the model to evaluate the current configuration.' : 'Inspect the measured result; training performance alone does not establish generalization.'}
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5 text-[11px] font-mono text-[#3CD5AA]">
                <span>Status: {isStale ? 'Awaiting calculation' : 'Computed locally'}</span>
                <span>Deterministic Seed: #42</span>
              </div>
            </div>
          </div>
        ))}
      </footer>
      {!isStale && modelResult?.predictProbability && isFeatureEnabled('error_explorer') && <section className="p-4"><ErrorExplorer baselineRunId={currentRunId} samples={testPoints.map(p=>({id:p.id,split:'validation',actual:p.label,predictedProb:modelResult.predictProbability(p.x,p.y),features:{x:p.x,y:p.y}}))} onSelectSample={sample=>setSelectedContext({type:'sample',data:sample})} /></section>}
      {!isStale && heldOutPoints.length>0 && modelResult?.predictProbability && <section className="p-4"><p>{heldOutPoints.length} test samples remain held out. Viewing them is recorded.</p><button className="p-3 bg-cyan-800 rounded" onClick={()=>{const accuracy=heldOutPoints.filter(p=>(modelResult.predictProbability(p.x,p.y)>=threshold?1:0)===p.label).length/heldOutPoints.length;setTestResult(accuracy);setTestAccessHistory(history=>[...history,{accessedAt:new Date().toISOString(),configuration:configKey}]);}}>Evaluate held-out test</button>{testResult!==null&&<p>Test accuracy: {testResult.toFixed(4)}</p>}</section>}
    </div>
  );
}
