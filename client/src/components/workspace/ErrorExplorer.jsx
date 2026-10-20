import { getSnapshotLocal, saveSnapshotLocal } from '../../services/localRepository.js';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sliders, 
  Filter, 
  GitCompare, 
  FileText, 
  Plus
} from 'lucide-react';
import { 
  evaluateSamplePredictions, 
  compareRunErrors, 
  createAnnotation 
} from '../../ml/errorExplorer.js';

export default function ErrorExplorer({ 
  samples = [], 
  baselineRunId = 'run-current',
  comparisonSamples = null,
  comparisonRunId = null,
  onSelectSample = null,
  className = '' 
}) {
  const [threshold, setThreshold] = useState(0.5);
  const [selectedCell, setSelectedCell] = useState(null); // 'TP', 'FP', 'TN', 'FN' or null
  const [selectedTag, setSelectedTag] = useState('all'); // 'all', 'wrong', 'confidently_wrong', 'borderline'
  const [selectedSampleId, setSelectedSampleId] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [annotations, setAnnotations] = useState([]);
  const [activeTab, setActiveTab] = useState('eval'); // 'eval' or 'compare'

  const [storageError,setStorageError]=useState('');
  useEffect(()=>{getSnapshotLocal('annotations:'+baselineRunId).then(record=>setAnnotations(record?.annotations || [])).catch(error=>setStorageError(error.message));},[baselineRunId]);
  // Dynamic evaluation without modifying original run
  const evalResult = useMemo(() => {
    return evaluateSamplePredictions(samples, { threshold });
  }, [samples, threshold]);

  // Comparative evaluation if comparisonSamples provided
  const comparisonResult = useMemo(() => {
    if (!comparisonSamples || comparisonSamples.length === 0) return null;
    const baseEvals = evalResult.sampleEvaluations;
    const compEvals = evaluateSamplePredictions(comparisonSamples, { threshold }).sampleEvaluations;
    return compareRunErrors(baseEvals, compEvals);
  }, [comparisonSamples, evalResult, threshold]);

  // Filtered samples based on selection
  const visibleSamples = useMemo(() => {
    return evalResult.sampleEvaluations.filter(s => {
      if (selectedCell && s.cell !== selectedCell) return false;
      if (selectedTag === 'wrong' && s.isCorrect) return false;
      if (selectedTag === 'confidently_wrong' && !s.isConfidentlyWrong) return false;
      if (selectedTag === 'borderline' && !s.isBorderline) return false;
      return true;
    });
  }, [evalResult, selectedCell, selectedTag]);

  const { metrics } = evalResult;

  const handleAddAnnotation = async (sampleId) => {
    if (!annotationText.trim()) return;
    const ann = createAnnotation({
      runId: baselineRunId,
      sampleId,
      text: annotationText,
      author: 'Researcher',
    });
    try { const next=[...annotations,ann]; await saveSnapshotLocal({id:'annotations:'+baselineRunId,annotations:next}); setAnnotations(next);setStorageError(''); }catch(error){setStorageError(error.message);return;}
    setAnnotationText('');
  };

  return (
    <div className={`rounded-xl bg-obsidian border border-white/10 p-4 text-xs font-mono shadow-xl flex flex-col space-y-4 ${className}`}>
      {storageError && <p role="alert">Observation not saved: {storageError}</p>}
      {/* Header & Tabs */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-plasma-cyan" />
          <span className="font-semibold text-white tracking-wide">Error Explorer</span>
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-text-muted">
            {samples.length} samples
          </span>
        </div>
        <div className="flex gap-1 bg-canvas-recessed p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('eval')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'eval' ? 'bg-plasma-cyan text-black' : 'text-text-muted hover:text-white'
            }`}
          >
            Diagnostics
          </button>
          {comparisonSamples && (
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                activeTab === 'compare' ? 'bg-plasma-cyan text-black' : 'text-text-muted hover:text-white'
              }`}
            >
              <GitCompare className="w-3 h-3" />
              Run Diff
            </button>
          )}
        </div>
      </div>

      {/* Small sample size caution badge */}
      {metrics.smallSampleCaution && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Small sample size (&lt; 20 samples). Evaluation metrics should not be treated as high-confidence statistical proof.</span>
        </div>
      )}

      {activeTab === 'eval' ? (
        <>
          {/* Threshold Tuning Slider */}
          <div className="space-y-1.5 bg-canvas-recessed/60 p-3 rounded-lg border border-white/5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-text-muted flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-plasma-cyan" />
                Decision Threshold (&theta;)
              </span>
              <span className="text-plasma-cyan font-bold">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.99"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-plasma-cyan cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted/50">
              <span>0.01 (High Recall)</span>
              <span>0.50 (Default)</span>
              <span>0.99 (High Precision)</span>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-canvas-recessed p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-text-muted">Accuracy</span>
              <div className="text-sm font-bold text-white mt-0.5">{(metrics.accuracy * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-canvas-recessed p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-text-muted">Precision</span>
              <div className="text-sm font-bold text-quantum-mint mt-0.5">{(metrics.precision * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-canvas-recessed p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-text-muted">Recall</span>
              <div className="text-sm font-bold text-plasma-cyan mt-0.5">{(metrics.recall * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-canvas-recessed p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-text-muted">F1 Score</span>
              <div className="text-sm font-bold text-neural-violet mt-0.5">{metrics.f1.toFixed(3)}</div>
            </div>
          </div>

          {/* Interactive Confusion Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span className="font-semibold text-white">Confusion Matrix</span>
              {selectedCell && (
                <button 
                  onClick={() => setSelectedCell(null)}
                  className="text-[10px] text-plasma-cyan hover:underline"
                >
                  Clear filter ({selectedCell})
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* True Positive */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'TP' ? null : 'TP')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'TP' 
                    ? 'border-quantum-mint bg-quantum-mint/10 shadow-[0_0_10px_rgba(60,213,170,0.2)]' 
                    : 'border-white/5 bg-canvas-recessed hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-quantum-mint font-bold">TP (True Pos)</span>
                  <span className="text-xs font-bold text-white">{metrics.tp}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1">Act 1 &rarr; Pred 1</div>
              </button>

              {/* False Positive */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'FP' ? null : 'FP')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'FP' 
                    ? 'border-alert-red bg-alert-red/10 shadow-[0_0_10px_rgba(255,92,92,0.2)]' 
                    : 'border-white/5 bg-canvas-recessed hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-alert-red font-bold">FP (False Pos)</span>
                  <span className="text-xs font-bold text-white">{metrics.fp}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1">Act 0 &rarr; Pred 1</div>
              </button>

              {/* False Negative */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'FN' ? null : 'FN')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'FN' 
                    ? 'border-alert-red bg-alert-red/10 shadow-[0_0_10px_rgba(255,92,92,0.2)]' 
                    : 'border-white/5 bg-canvas-recessed hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-alert-red font-bold">FN (False Neg)</span>
                  <span className="text-xs font-bold text-white">{metrics.fn}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1">Act 1 &rarr; Pred 0</div>
              </button>

              {/* True Negative */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'TN' ? null : 'TN')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'TN' 
                    ? 'border-quantum-mint bg-quantum-mint/10 shadow-[0_0_10px_rgba(60,213,170,0.2)]' 
                    : 'border-white/5 bg-canvas-recessed hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-quantum-mint font-bold">TN (True Neg)</span>
                  <span className="text-xs font-bold text-white">{metrics.tn}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1">Act 0 &rarr; Pred 0</div>
              </button>
            </div>
          </div>

          {/* Quick Filter Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-text-muted hover:text-white'
              }`}
            >
              All ({evalResult.sampleEvaluations.length})
            </button>
            <button
              onClick={() => setSelectedTag('wrong')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'wrong' ? 'bg-alert-red/30 text-alert-red' : 'bg-white/5 text-text-muted hover:text-alert-red'
              }`}
            >
              Errors ({metrics.incorrect})
            </button>
            <button
              onClick={() => setSelectedTag('confidently_wrong')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'confidently_wrong' ? 'bg-amber-500/30 text-amber-300' : 'bg-white/5 text-text-muted hover:text-amber-300'
              }`}
            >
              Confidently Wrong ({metrics.confidentlyWrongCount})
            </button>
            <button
              onClick={() => setSelectedTag('borderline')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'borderline' ? 'bg-neural-violet/30 text-neural-violet' : 'bg-white/5 text-text-muted hover:text-neural-violet'
              }`}
            >
              Borderline ({metrics.borderlineCount})
            </button>
          </div>

          {/* Sample Breakdown Table */}
          <div className="border border-white/5 rounded-lg overflow-hidden">
            <div className="bg-canvas-recessed px-3 py-2 text-[11px] font-semibold text-white/90 border-b border-white/5 flex justify-between">
              <span>Inspected Samples ({visibleSamples.length})</span>
              <span className="text-text-muted text-[10px]">Click row to inspect / annotate</span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
              {visibleSamples.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-[11px]">No samples match current criteria.</div>
              ) : (
                visibleSamples.map(sample => (
                  <div
                    key={sample.id}
                    onClick={() => {
                      setSelectedSampleId(sample.id);
                      if (onSelectSample) onSelectSample(sample);
                    }}
                    className={`px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${
                      selectedSampleId === sample.id ? 'bg-plasma-cyan/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {sample.isCorrect ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-quantum-mint" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-alert-red" />
                      )}
                      <span className="font-bold text-white text-[11px]">{sample.id}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-white/5 text-text-muted">
                        {sample.cell}
                      </span>
                      {sample.isConfidentlyWrong && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">
                          Confident Err
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-right">
                      <span className="text-text-muted">Act: {sample.actual} | </span>
                      <span className="text-plasma-cyan">Prob: {sample.predictedProb.toFixed(3)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sample Annotation Box */}
          {selectedSampleId && (
            <div className="bg-canvas-recessed p-3 rounded-lg border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-quantum-mint" />
                  Observation for Sample {selectedSampleId}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Record failure analysis observation..."
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  className="flex-1 bg-obsidian border border-white/10 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-plasma-cyan"
                />
                <button
                  onClick={() => handleAddAnnotation(selectedSampleId)}
                  className="px-3 py-1 bg-plasma-cyan hover:bg-accent-teal text-black font-semibold rounded text-[11px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Save
                </button>
              </div>

              {/* Existing annotations for this run/sample */}
              {annotations.filter(a => a.sampleId === selectedSampleId).length > 0 && (
                <div className="pt-2 space-y-1">
                  {annotations.filter(a => a.sampleId === selectedSampleId).map(a => (
                    <div key={a.id} className="text-[10px] bg-white/5 p-1.5 rounded text-text-muted flex justify-between">
                      <span>{a.text}</span>
                      <span className="text-[9px] text-text-muted/50">{new Date(a.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Run Comparison View */
        comparisonResult && (
          <div className="space-y-3">
            <div className="text-[11px] text-text-muted">
              Comparing baseline run <span className="text-white font-bold">{baselineRunId}</span> vs candidate <span className="text-white font-bold">{comparisonRunId || 'candidate'}</span> on {comparisonResult.totalCompared} identical samples:
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-canvas-recessed p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-quantum-mint font-bold">Corrected Mistakes</div>
                <div className="text-base font-bold text-white mt-1">+{comparisonResult.counts.correctedErrors}</div>
                <div className="text-[9px] text-text-muted mt-0.5">Fixed in candidate</div>
              </div>

              <div className="bg-canvas-recessed p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-alert-red font-bold">New Regressions</div>
                <div className="text-base font-bold text-white mt-1">-{comparisonResult.counts.regressedErrors}</div>
                <div className="text-[9px] text-text-muted mt-0.5">Newly broken</div>
              </div>

              <div className="bg-canvas-recessed p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-amber-400 font-bold">Persistent Errors</div>
                <div className="text-base font-bold text-white mt-1">{comparisonResult.counts.sharedErrors}</div>
                <div className="text-[9px] text-text-muted mt-0.5">Both failed</div>
              </div>
            </div>

            {/* List of regressed samples */}
            {comparisonResult.regressedErrors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-alert-red/10 border border-alert-red/20 text-[11px] space-y-1">
                <div className="font-bold text-alert-red flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Newly Introduced Errors ({comparisonResult.regressedErrors.length})
                </div>
                <div className="text-[10px] text-text-muted">
                  These samples were correct in baseline but failed in the candidate model:
                </div>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {comparisonResult.regressedErrors.map(({ sampleA }) => (
                    <span key={sampleA.id} className="px-1.5 py-0.5 rounded bg-white/5 text-white text-[10px]">
                      {sampleA.id} (P: {sampleA.predictedProb.toFixed(2)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
