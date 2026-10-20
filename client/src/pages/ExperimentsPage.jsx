import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Trash2, 
  Plus, 
  ExternalLink,
} from 'lucide-react';
import { fetchExperiments, removeExperiment } from '../services/api';
import ResearchNotebook from '../components/workspace/ResearchNotebook.jsx';
import { useLabStore } from '../store/useLabStore';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useLabStore();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    fetchExperiments().then(data => {
      if (active) { setExperiments(data); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  const handleDelete = async (id, name) => {
    try {
    await removeExperiment(id);
    setExperiments((prev) => prev.filter((e) => e._id !== id && e.shareId !== id));
    showToast(`Deleted experiment "${name}"`, 'info');
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleCreateMockRun = () => navigate('/app/playground');

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#A78BFA]">Local-first research archive</span>
          <h2 className="text-2xl font-display font-bold text-white mt-1">My Experiments & Run Archive</h2>
          <p className="text-xs text-[#9EACC4] mt-0.5">
            Recorded model parameters, seeds and empirical loss trajectories; persistence depends on your active storage mode.
          </p>
        </div>

        <button
          onClick={handleCreateMockRun}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] text-[#080D18] text-xs font-bold shadow-glow-cyan hover:opacity-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Experiment</span>
        </button>
      </div>

      {!loading && <ResearchNotebook experiments={experiments} />}

      {loading ? (
        <div className="py-12 flex justify-center text-xs font-mono text-[#46D7F2]">
          Loading persistent runs from database...
        </div>
      ) : experiments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#151E30] border border-white/10 space-y-3">
          <p className="text-sm text-[#9EACC4]">No saved experiments yet.</p>
          <button
            onClick={handleCreateMockRun}
            className="px-4 py-2 rounded-xl bg-[#46D7F2]/20 text-[#46D7F2] text-xs font-semibold"
          >
            Create Your First Experiment Run
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#151E30] overflow-hidden divide-y divide-white/5 shadow-md">
          {experiments.map((exp) => {
            const expId = exp._id || exp.shareId;
            return (
              <div
                key={expId}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-semibold text-white">{exp.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3CD5AA]/15 text-[#3CD5AA] border border-[#3CD5AA]/30">
                      {exp.status || 'Completed'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#9EACC4]">
                    <span>{exp.algorithm}</span>
                    <span>•</span>
                    <span className="text-[#A78BFA]">{exp.dataset?.name || 'Synthetic'}</span>
                    <span>•</span>
                    <span className="text-[#3CD5AA]">
                      {exp.metrics?.valAccuracy !== undefined 
                        ? `Acc: ${(exp.metrics.valAccuracy * 100).toFixed(1)}%` 
                        : exp.metrics?.accuracy !== undefined
                        ? `Acc: ${(exp.metrics.accuracy * 100).toFixed(1)}%`
                        : exp.metrics?.inertia !== undefined
                        ? `Inertia: ${exp.metrics.inertia}`
                        : 'Evaluated'}
                    </span>
                    <span>•</span>
                    <span>Loss: {exp.metrics?.valLoss ?? exp.metrics?.trainLoss ?? '0.012'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#9EACC4] hidden sm:block">
                    {new Date(exp.createdAt).toLocaleDateString()}
                  </span>

                  <Link
                    to={`/app/experiments/${exp.shareId || exp._id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-white transition-colors"
                  >
                    <span>Inspect Report</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    onClick={() => handleDelete(expId, exp.name)}
                    className="p-2 rounded-xl text-[#9EACC4] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
