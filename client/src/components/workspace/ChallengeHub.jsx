import { saveSnapshotLocal } from '../../services/localRepository.js';
import { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Award, 
  FileText, 
  Download,
  Lightbulb
} from 'lucide-react';
import { CHALLENGE_TEMPLATES, gradeInvestigation } from '../../ml/challenges.js';
import { createEvidenceReport } from '../../ml/evidenceReport.js';

export default function ChallengeHub({
  activeRun = null,
  className = ''
}) {
  const [selectedChallengeId, setSelectedChallengeId] = useState(CHALLENGE_TEMPLATES[0].id);
  const [observations, setObservations] = useState('');
  const [limitations, setLimitations] = useState('');
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [activeTab, setActiveTab] = useState('challenge'); // 'challenge', 'report'

  const activeChallenge = useMemo(() => {
    return CHALLENGE_TEMPLATES.find(c => c.id === selectedChallengeId) || CHALLENGE_TEMPLATES[0];
  }, [selectedChallengeId]);

  const handleGrade = () => {
    if (!activeRun) return;
    const res = gradeInvestigation(activeChallenge.id, activeRun, observations);
    setEvaluationResult(res);
  };

  const handleCreateReport = async () => {
    if (!activeRun) return;
    const rep = createEvidenceReport({
      title: `Scientific Investigation: ${activeChallenge.title}`,
      author: 'NeuroForge Explorer',
      runs: [activeRun],
      observations,
      limitations,
      isLive: false,
    });
    try { await saveSnapshotLocal({ id:'evidence-report:'+rep.id, report:rep }); } catch(error) { setGeneratedReport({ ...rep, storageError:error.message }); setActiveTab('report'); return; }
    setGeneratedReport(rep);
    setActiveTab('report');
  };

  return (
    <div className={`rounded-xl bg-obsidian border border-white/10 p-4 text-xs font-mono shadow-xl flex flex-col space-y-4 ${className}`}>
      {generatedReport?.storageError && <p role="alert">Report is available for export but was not saved: {generatedReport.storageError}</p>}
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-quantum-mint" />
          <span className="font-semibold text-white tracking-wide">Investigation Academy</span>
        </div>
        <div className="flex gap-1 bg-canvas-recessed p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('challenge')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'challenge' ? 'bg-quantum-mint text-black font-semibold' : 'text-text-muted hover:text-white'
            }`}
          >
            Challenges
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'report' ? 'bg-quantum-mint text-black font-semibold' : 'text-text-muted hover:text-white'
            }`}
          >
            Evidence Report {generatedReport ? '(Ready)' : ''}
          </button>
        </div>
      </div>

      {activeTab === 'challenge' ? (
        <div className="space-y-4">
          {/* Challenge Selector */}
          <div className="space-y-1">
            <label className="text-[10px] text-text-muted block">Select Investigation Challenge:</label>
            <select
              value={selectedChallengeId}
              onChange={e => {
                setSelectedChallengeId(e.target.value);
                setEvaluationResult(null);
              }}
              className="w-full bg-canvas-recessed border border-white/10 rounded px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-quantum-mint"
            >
              {CHALLENGE_TEMPLATES.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Objective Card */}
          <div className="bg-canvas-recessed p-3 rounded-lg border border-white/5 space-y-2">
            <div className="flex items-center gap-1.5 text-quantum-mint font-bold text-[11px]">
              <HelpCircle className="w-3.5 h-3.5" />
              Scientific Objective
            </div>
            <p className="text-[11px] text-white/90 leading-relaxed">
              {activeChallenge.objective}
            </p>

            {/* Hints list */}
            <div className="pt-2 border-t border-white/5 space-y-1">
              <div className="text-[10px] text-text-muted font-semibold flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-signal-amber" /> Hints:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-text-muted/80 pl-1">
                {activeChallenge.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Scientific Observation Input */}
          <div className="space-y-1">
            <label className="text-[10px] text-text-muted block font-semibold">
              Your Scientific Observation & Hypothesis:
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Record why this architecture/parameter choice produced this outcome..."
              className="w-full bg-canvas-recessed border border-white/10 rounded p-2 text-white text-[11px] focus:outline-none focus:border-quantum-mint"
            />
          </div>

          {/* Documented Limitations Input */}
          <div className="space-y-1">
            <label className="text-[10px] text-text-muted block font-semibold">
              Known Limitations & Threats to Validity:
            </label>
            <textarea
              rows={2}
              value={limitations}
              onChange={e => setLimitations(e.target.value)}
              placeholder="Document data scope, non-convergence risks, or seed sensitivity..."
              className="w-full bg-canvas-recessed border border-white/10 rounded p-2 text-white text-[11px] focus:outline-none focus:border-quantum-mint"
            />
          </div>

          {/* Evaluation Action */}
          <div className="flex gap-2">
            <button
              onClick={handleGrade}
              disabled={!activeRun}
              className={`flex-1 py-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                activeRun 
                  ? 'bg-quantum-mint hover:bg-success-teal text-black' 
                  : 'bg-white/5 text-text-muted cursor-not-allowed'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              {activeRun ? 'Evaluate Active Run Against Rubric' : 'No Completed Run to Evaluate'}
            </button>

            {activeRun && (
              <button
                onClick={handleCreateReport}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded text-[11px] flex items-center gap-1 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-plasma-cyan" />
                Compile Report
              </button>
            )}
          </div>

          {/* Rubric Evaluation Results */}
          {evaluationResult && (
            <div className="p-3 rounded-lg bg-canvas-recessed border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px]">Rubric Evaluation</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  evaluationResult.passed ? 'bg-quantum-mint/20 text-quantum-mint' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  Score: {evaluationResult.score}/100 {evaluationResult.passed ? '✓ PASSED' : 'INCOMPLETE'}
                </span>
              </div>

              <div className="space-y-1.5">
                {evaluationResult.checks.map((chk, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px]">
                    {chk.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-quantum-mint shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-alert-red shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className={chk.passed ? 'text-white' : 'text-alert-red'}>{chk.name}</span>
                      <p className="text-text-muted text-[9px]">{chk.feedback}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Report View */
        <div className="space-y-3">
          {generatedReport ? (
            <>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-semibold text-white">{generatedReport.title}</span>
                <button
                  onClick={() => {
                    const blob = new Blob([generatedReport.markdownContent], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${generatedReport.id}.md`;
                    a.click();
                  }}
                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-plasma-cyan flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Export Markdown
                </button>
              </div>

              <div className="bg-canvas-recessed p-3 rounded-lg border border-white/5 max-h-64 overflow-y-auto font-mono text-[10px] text-text-muted whitespace-pre-wrap leading-relaxed">
                {generatedReport.markdownContent}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-text-muted bg-canvas-recessed rounded-lg border border-white/5">
              No report compiled yet. Click &quot;Compile Report&quot; on a completed run to generate an evidence-backed report.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
