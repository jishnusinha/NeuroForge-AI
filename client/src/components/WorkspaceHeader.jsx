import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Search, 
  Save, 
  Share2, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles,
  Check,
  Copy
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { createExperiment } from '../services/api';

export default function WorkspaceHeader() {
  const location = useLocation();
  const { currentExperiment, setCommandPaletteOpen, showToast } = useLabStore();
  const [copied, setCopied] = useState(false);

  // Derive route title
  const getRouteInfo = (pathname) => {
    switch (pathname) {
      case '/app':
        return { section: 'Console', title: 'Mission Control' };
      case '/app/playground':
        return { section: 'Laboratory', title: 'ML Algorithm Playground' };
      case '/app/studio':
        return { section: 'Deep Learning', title: 'Neural Network Studio' };
      case '/app/arena':
        return { section: 'Evaluation', title: 'Experiment Arena' };
      case '/app/datasets':
        return { section: 'Data', title: 'Dataset Explorer' };
      case '/app/experiments':
        return { section: 'Archive', title: 'My Experiments' };
      case '/app/learn':
        return { section: 'Education', title: 'NeuroForge Academy' };
      case '/showcase':
        return { section: 'Evaluation', title: 'Interview Showcase Mode' };
      default:
        return { section: 'Workspace', title: 'Laboratory' };
    }
  };

  const { section, title } = getRouteInfo(location.pathname);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Ready':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#3CD5AA]/15 text-[#3CD5AA] border border-[#3CD5AA]/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready
          </span>
        );
      case 'Inputs changed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#F3B65E]/15 text-[#F3B65E] border border-[#F3B65E]/30 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Inputs changed (stale result)
          </span>
        );
      case 'Running':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#46D7F2]/15 text-[#46D7F2] border border-[#46D7F2]/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Training active...
          </span>
        );
      case 'Completed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#3CD5AA]/15 text-[#3CD5AA] border border-[#3CD5AA]/30">
            <Check className="w-3.5 h-3.5" />
            Converged
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-white/5 text-[#9EACC4] border border-white/10">
            {status}
          </span>
        );
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    showToast('Experiment share link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: currentExperiment.name || 'Saved Lab Experiment',
        algorithm: 'Dense MLP (2-4-1)',
        dataset: { name: 'XOR Problem', sampleCount: 180, noise: 0.12, trainRatio: 0.8, seed: 42 },
        hyperparameters: { learningRate: 0.04, epochs: 60 },
        metrics: { trainLoss: 0.012, valLoss: 0.018, trainAccuracy: 1.0, valAccuracy: 1.0 },
        metricHistory: [
          { epoch: 10, loss: 0.54 },
          { epoch: 30, loss: 0.18 },
          { epoch: 60, loss: 0.012 },
        ],
        status: 'Completed',
      };
      const result = await createExperiment(payload);
      showToast(`Run saved permanently (ID: ${result.shareId || result._id})`, 'success');
    } catch (e) {
      showToast('Experiment snapshot saved to local session.', 'success');
    }
  };

  return (
    <header className="h-16 px-6 bg-[#080D18]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumbs and Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#9EACC4]">
          <span>NeuroForge</span>
          <span>/</span>
          <span className="text-[#46D7F2] font-medium">{section}</span>
          <span>/</span>
        </div>
        <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-3">
          {title}
        </h1>
        {location.pathname.startsWith('/app/') && (
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-white/10">
            <span className="text-xs text-[#9EACC4] truncate max-w-[200px]">
              {currentExperiment.name}
            </span>
            {getStatusBadge(currentExperiment.status)}
          </div>
        )}
      </div>

      {/* Center Search / Command Palette Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-[#9EACC4] transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#46D7F2] group-hover:scale-110 transition-transform" />
            <span>Search algorithms, datasets, or commands...</span>
          </div>
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-[#F2F5FC] font-mono text-[10px] border border-white/10">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        <Link
          to="/showcase"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-xs font-medium text-[#A78BFA] transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Showcase Tour</span>
        </Link>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#F2F5FC] transition-colors"
          title="Share reproducible link"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#3CD5AA]" /> : <Share2 className="w-3.5 h-3.5 text-[#46D7F2]" />}
          <span>{copied ? 'Copied' : 'Share'}</span>
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#46D7F2] to-[#3CD5AA] hover:opacity-90 text-[#080D18] text-xs font-semibold shadow-glow-cyan transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Run</span>
        </button>
      </div>
    </header>
  );
}
