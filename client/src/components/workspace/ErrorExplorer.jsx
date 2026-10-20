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
    <div className={`rounded-xl bg-[#151E30] border border-white/10 p-4 text-xs font-mono shadow-xl flex flex-col space-y-4 ${className}`}>
      {storageError && <p role="alert">Observation not saved: {storageError}</p>}
      {/* Header & Tabs */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#46D7F2]" />
          <span className="font-semibold text-white tracking-wide">Error Explorer</span>
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-[#9EACC4]">
            {samples.length} samples
          </span>
        </div>
        <div className="flex gap-1 bg-[#0A0F1D] p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('eval')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'eval' ? 'bg-[#46D7F2] text-black' : 'text-[#9EACC4] hover:text-white'
            }`}
          >
            Diagnostics
          </button>
          {comparisonSamples && (
            <button
              onClick={() => setActiveTab('compare')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                activeTab === 'compare' ? 'bg-[#46D7F2] text-black' : 'text-[#9EACC4] hover:text-white'
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
          <div className="space-y-1.5 bg-[#0A0F1D]/60 p-3 rounded-lg border border-white/5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-[#9EACC4] flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-[#46D7F2]" />
                Decision Threshold (&theta;)
              </span>
              <span className="text-[#46D7F2] font-bold">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.99"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#46D7F2] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#9EACC4]/50">
              <span>0.01 (High Recall)</span>
              <span>0.50 (Default)</span>
              <span>0.99 (High Precision)</span>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-[#0A0F1D] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-[#9EACC4]">Accuracy</span>
              <div className="text-sm font-bold text-white mt-0.5">{(metrics.accuracy * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-[#0A0F1D] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-[#9EACC4]">Precision</span>
              <div className="text-sm font-bold text-[#3CD5AA] mt-0.5">{(metrics.precision * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-[#0A0F1D] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-[#9EACC4]">Recall</span>
              <div className="text-sm font-bold text-[#46D7F2] mt-0.5">{(metrics.recall * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-[#0A0F1D] p-2 rounded-lg border border-white/5">
              <span className="text-[10px] text-[#9EACC4]">F1 Score</span>
              <div className="text-sm font-bold text-[#A78BFA] mt-0.5">{metrics.f1.toFixed(3)}</div>
            </div>
          </div>

          {/* Interactive Confusion Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#9EACC4]">
              <span className="font-semibold text-white">Confusion Matrix</span>
              {selectedCell && (
                <button 
                  onClick={() => setSelectedCell(null)}
                  className="text-[10px] text-[#46D7F2] hover:underline"
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
                    ? 'border-[#3CD5AA] bg-[#3CD5AA]/10 shadow-[0_0_10px_rgba(60,213,170,0.2)]' 
                    : 'border-white/5 bg-[#0A0F1D] hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#3CD5AA] font-bold">TP (True Pos)</span>
                  <span className="text-xs font-bold text-white">{metrics.tp}</span>
                </div>
                <div className="text-[10px] text-[#9EACC4] mt-1">Act 1 &rarr; Pred 1</div>
              </button>

              {/* False Positive */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'FP' ? null : 'FP')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'FP' 
                    ? 'border-[#FF5C5C] bg-[#FF5C5C]/10 shadow-[0_0_10px_rgba(255,92,92,0.2)]' 
                    : 'border-white/5 bg-[#0A0F1D] hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#FF5C5C] font-bold">FP (False Pos)</span>
                  <span className="text-xs font-bold text-white">{metrics.fp}</span>
                </div>
                <div className="text-[10px] text-[#9EACC4] mt-1">Act 0 &rarr; Pred 1</div>
              </button>

              {/* False Negative */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'FN' ? null : 'FN')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'FN' 
                    ? 'border-[#FF5C5C] bg-[#FF5C5C]/10 shadow-[0_0_10px_rgba(255,92,92,0.2)]' 
                    : 'border-white/5 bg-[#0A0F1D] hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#FF5C5C] font-bold">FN (False Neg)</span>
                  <span className="text-xs font-bold text-white">{metrics.fn}</span>
                </div>
                <div className="text-[10px] text-[#9EACC4] mt-1">Act 1 &rarr; Pred 0</div>
              </button>

              {/* True Negative */}
              <button
                onClick={() => setSelectedCell(selectedCell === 'TN' ? null : 'TN')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  selectedCell === 'TN' 
                    ? 'border-[#3CD5AA] bg-[#3CD5AA]/10 shadow-[0_0_10px_rgba(60,213,170,0.2)]' 
                    : 'border-white/5 bg-[#0A0F1D] hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#3CD5AA] font-bold">TN (True Neg)</span>
                  <span className="text-xs font-bold text-white">{metrics.tn}</span>
                </div>
                <div className="text-[10px] text-[#9EACC4] mt-1">Act 0 &rarr; Pred 0</div>
              </button>
            </div>
          </div>

          {/* Quick Filter Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-[#9EACC4] flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-[#9EACC4] hover:text-white'
              }`}
            >
              All ({evalResult.sampleEvaluations.length})
            </button>
            <button
              onClick={() => setSelectedTag('wrong')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'wrong' ? 'bg-[#FF5C5C]/30 text-[#FF5C5C]' : 'bg-white/5 text-[#9EACC4] hover:text-[#FF5C5C]'
              }`}
            >
              Errors ({metrics.incorrect})
            </button>
            <button
              onClick={() => setSelectedTag('confidently_wrong')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'confidently_wrong' ? 'bg-amber-500/30 text-amber-300' : 'bg-white/5 text-[#9EACC4] hover:text-amber-300'
              }`}
            >
              Confidently Wrong ({metrics.confidentlyWrongCount})
            </button>
            <button
              onClick={() => setSelectedTag('borderline')}
              className={`px-2 py-0.5 rounded text-[10px] ${
                selectedTag === 'borderline' ? 'bg-[#A78BFA]/30 text-[#A78BFA]' : 'bg-white/5 text-[#9EACC4] hover:text-[#A78BFA]'
              }`}
            >
              Borderline ({metrics.borderlineCount})
            </button>
          </div>

          {/* Sample Breakdown Table */}
          <div className="border border-white/5 rounded-lg overflow-hidden">
            <div className="bg-[#0A0F1D] px-3 py-2 text-[11px] font-semibold text-white/90 border-b border-white/5 flex justify-between">
              <span>Inspected Samples ({visibleSamples.length})</span>
              <span className="text-[#9EACC4] text-[10px]">Click row to inspect / annotate</span>
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
              {visibleSamples.length === 0 ? (
                <div className="p-4 text-center text-[#9EACC4] text-[11px]">No samples match current criteria.</div>
              ) : (
                visibleSamples.map(sample => (
                  <div
                    key={sample.id}
                    onClick={() => {
                      setSelectedSampleId(sample.id);
                      if (onSelectSample) onSelectSample(sample);
                    }}
                    className={`px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors ${
                      selectedSampleId === sample.id ? 'bg-[#46D7F2]/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {sample.isCorrect ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#3CD5AA]" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#FF5C5C]" />
                      )}
                      <span className="font-bold text-white text-[11px]">{sample.id}</span>
                      <span className="text-[10px] px-1 py-0.2 rounded bg-white/5 text-[#9EACC4]">
                        {sample.cell}
                      </span>
                      {sample.isConfidentlyWrong && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300">
                          Confident Err
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-right">
                      <span className="text-[#9EACC4]">Act: {sample.actual} | </span>
                      <span className="text-[#46D7F2]">Prob: {sample.predictedProb.toFixed(3)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sample Annotation Box */}
          {selectedSampleId && (
            <div className="bg-[#0A0F1D] p-3 rounded-lg border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#3CD5AA]" />
                  Observation for Sample {selectedSampleId}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Record failure analysis observation..."
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  className="flex-1 bg-[#151E30] border border-white/10 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-[#46D7F2]"
                />
                <button
                  onClick={() => handleAddAnnotation(selectedSampleId)}
                  className="px-3 py-1 bg-[#46D7F2] hover:bg-[#38b2c9] text-black font-semibold rounded text-[11px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Save
                </button>
              </div>

              {/* Existing annotations for this run/sample */}
              {annotations.filter(a => a.sampleId === selectedSampleId).length > 0 && (
                <div className="pt-2 space-y-1">
                  {annotations.filter(a => a.sampleId === selectedSampleId).map(a => (
                    <div key={a.id} className="text-[10px] bg-white/5 p-1.5 rounded text-[#9EACC4] flex justify-between">
                      <span>{a.text}</span>
                      <span className="text-[9px] text-[#9EACC4]/50">{new Date(a.createdAt).toLocaleTimeString()}</span>
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
            <div className="text-[11px] text-[#9EACC4]">
              Comparing baseline run <span className="text-white font-bold">{baselineRunId}</span> vs candidate <span className="text-white font-bold">{comparisonRunId || 'candidate'}</span> on {comparisonResult.totalCompared} identical samples:
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0A0F1D] p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-[#3CD5AA] font-bold">Corrected Mistakes</div>
                <div className="text-base font-bold text-white mt-1">+{comparisonResult.counts.correctedErrors}</div>
                <div className="text-[9px] text-[#9EACC4] mt-0.5">Fixed in candidate</div>
              </div>

              <div className="bg-[#0A0F1D] p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-[#FF5C5C] font-bold">New Regressions</div>
                <div className="text-base font-bold text-white mt-1">-{comparisonResult.counts.regressedErrors}</div>
                <div className="text-[9px] text-[#9EACC4] mt-0.5">Newly broken</div>
              </div>

              <div className="bg-[#0A0F1D] p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-amber-400 font-bold">Persistent Errors</div>
                <div className="text-base font-bold text-white mt-1">{comparisonResult.counts.sharedErrors}</div>
                <div className="text-[9px] text-[#9EACC4] mt-0.5">Both failed</div>
              </div>
            </div>

            {/* List of regressed samples */}
            {comparisonResult.regressedErrors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-[#FF5C5C]/10 border border-[#FF5C5C]/20 text-[11px] space-y-1">
                <div className="font-bold text-[#FF5C5C] flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  Newly Introduced Errors ({comparisonResult.regressedErrors.length})
                </div>
                <div className="text-[10px] text-[#9EACC4]">
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
