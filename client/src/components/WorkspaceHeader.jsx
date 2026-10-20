import { isFeatureEnabled } from '../services/productionConfig.js';
import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Save,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Check,
  Maximize2,
  Minimize2,
  Bell
} from 'lucide-react';
import { useLabStore } from '../store/useLabStore';
import { draftManager } from '../services/draftManager.js';
import { createExperiment, createShare } from '../services/api';
import ViewModeToggle from './workspace/ViewModeToggle';
import ThemePicker from './ThemePicker.jsx';
import DraftRecoveryModal from './workspace/DraftRecoveryModal';

export default function WorkspaceHeader() {
  const cloudSyncState=useLabStore(state=>state.cloudSyncState);
  const location = useLocation();
  const navigate = useNavigate();
  const loadRun = useLabStore(state => state.loadRun);
  const resolveConflict = async action => {
    try { const draft = await draftManager.resolveConflict(action); loadRun({ ...draft.configuration, workspace: draft.workspace, _draftId: draft.id, _draftRevision: draft.revision }); setConflictModalOpen(false); setDraftConflict(null); setDraftStorageState('saved_local'); navigate('/app/'+draft.workspace); }
    catch(error) { showToast(error.message,'error'); }
  };
  const {
    currentExperiment,
    activeRun,
    savedRun,
    setSavedRun,
    setExperimentName,
    setCommandPaletteOpen,
    showToast,
    focusMode,
    toggleFocusMode,
    notifications,
    toggleNotificationDrawer,
    draftStorageState,
    setDraftStorageState,
    draftConflict,
    setDraftConflict
  } = useLabStore();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const editable = ['/app/playground','/app/studio'].includes(location.pathname);
  const unreadCount = notifications.filter(n => !n.read).length;


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
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-quantum-mint/15 text-quantum-mint border border-quantum-mint/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready
          </span>
        );
      case 'Inputs changed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-signal-amber/15 text-signal-amber border border-signal-amber/30 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Inputs changed (stale result)
          </span>
        );
      case 'Running':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-plasma-cyan/15 text-plasma-cyan border border-plasma-cyan/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Training active...
          </span>
        );
      case 'Completed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-quantum-mint/15 text-quantum-mint border border-quantum-mint/30">
            <Check className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-white/5 text-text-muted border border-white/10">
            {status}
          </span>
        );
    }
  };

  const handleShare = async () => {
    try {
      if (!savedRun) throw new Error('Save the current run before sharing.');
      if (savedRun.storage === 'local') throw new Error('This run is stored on this browser only. Export its report to share it.');
      const result = await createShare(savedRun._id);
      await navigator.clipboard.writeText(window.location.origin + '/report/' + result.data.shareId);
      setCopied(true);
      showToast('Report link copied.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!activeRun || currentExperiment.status !== 'Completed') throw new Error('Complete a run with the current inputs before saving.');
      const payload = { ...activeRun, name: currentExperiment.name === 'Untitled Experiment' ? activeRun.name : currentExperiment.name || activeRun.name };
      const result = await createExperiment(payload);
      setSavedRun(result);
      showToast(`Run saved ${result.storage === 'local' ? 'in this browser' : result.storage === 'memory' ? 'in server memory (temporary)' : 'to database'}.`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <header className="min-h-16 py-2 px-3 sm:px-6 bg-deep-space/90 backdrop-blur-md border-b border-white/10 flex flex-wrap gap-2  items-center justify-between sticky top-0 z-30">
      {/* Breadcrumbs and Context */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono text-text-muted">
          <span>NeuroForge</span>
          <span>/</span>
          <span className="text-plasma-cyan font-medium">{section}</span>
          <span>/</span>
        </div>
        <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-3">
          {title}
        </h1>
        {location.pathname.startsWith('/app/') && (
          <div className="flex flex-wrap items-center gap-2 pl-3 border-l border-white/10">
            {editable && <input aria-label="Experiment name" value={currentExperiment.name} onChange={e => setExperimentName(e.target.value)} className="text-xs bg-transparent text-text-muted max-w-[180px]" />}
            {getStatusBadge(currentExperiment.status)}
            {draftStorageState === 'saved_local' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-quantum-mint/10 text-quantum-mint border border-quantum-mint/20" title="Saved to IndexedDB on this device">
                <Check className="w-3 h-3" />
                Saved on device
              </span>
            )}
            {cloudSyncState==='conflict'&&<span role="alert" className="text-amber-300 text-xs">Cloud conflict: local work preserved. <button onClick={()=>resolveConflict('duplicate')}>Save a copy for sync</button></span>}
            {draftStorageState === 'failed' && <span role="alert" className="text-red-300 text-xs">Draft not saved <button onClick={() => draftManager.saveNow().catch(error => showToast(error.message,'error'))}>Retry save</button></span>}
            {draftStorageState === 'saving' && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-plasma-cyan/10 text-plasma-cyan border border-plasma-cyan/20">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Saving...
              </span>
            )}
            {draftStorageState === 'conflict' && (
              <button
                type="button"
                onClick={() => setConflictModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-alert-pink/15 text-alert-pink border border-alert-pink/30 animate-pulse hover:bg-alert-pink/25"
                title="Cross-tab conflict detected. Click to resolve."
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Conflict
              </button>
            )}
          </div>
        )}
      </div>


      {/* Center Search / Command Palette Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-text-muted transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-plasma-cyan group-hover:scale-110 transition-transform" />
            <span>Search algorithms, datasets, or commands...</span>
          </div>
          <kbd className="px-2 py-0.5 rounded bg-white/10 text-text-primary font-mono text-[10px] border border-white/10">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right Actions: View Mode, Focus Mode, Notifications, Share, Save */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="lg:hidden"><ThemePicker compact /></div>
        {/* Guided vs Expert toggle for laboratory workspaces */}
        {editable && isFeatureEnabled('workspace_system') && <ViewModeToggle />}

        {/* Focus Mode toggle */}
        <button
          type="button"
          onClick={toggleFocusMode}
          className={`p-2 rounded-xl border transition-all text-xs flex items-center justify-center ${
            focusMode
              ? 'bg-plasma-cyan/20 border-plasma-cyan/50 text-plasma-cyan'
              : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-text-muted hover:text-white'
          }`}
          title={focusMode ? 'Exit Focus Mode (Alt+F)' : 'Enter Focus Mode (Alt+F)'}
          aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        >
          {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Notification Bell with unread badge */}
        <button
          type="button"
          onClick={toggleNotificationDrawer}
          className="relative p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-text-muted hover:text-white transition-colors"
          title="Notification History (Alt+N)"
          aria-label="Notification History"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-plasma-cyan text-ink-on-accent text-[9px] font-bold flex items-center justify-center shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <Link
          to="/showcase"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neural-violet/10 hover:bg-neural-violet/20 border border-neural-violet/30 text-xs font-medium text-neural-violet transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Showcase Tour</span>
        </Link>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-text-primary transition-colors"
          title="Share reproducible link"
          aria-label={copied ? 'Copied' : 'Share'}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-quantum-mint" /> : <Share2 className="w-3.5 h-3.5 text-plasma-cyan" />}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
        </button>

        {isFeatureEnabled('accounts_and_sync') && <Link to="/app/account" className="text-xs p-2">Account & Projects</Link>}
        {editable && <button
          onClick={handleSave}
          disabled={saving || !activeRun || currentExperiment.status !== 'Completed'}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-plasma-cyan to-quantum-mint hover:opacity-90 text-ink-on-accent text-xs font-semibold shadow-glow-cyan transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving...' : 'Save Run'}</span>
        </button>}
      </div>

      {/* Draft Conflict Modal */}
      <DraftRecoveryModal
        isOpen={conflictModalOpen || draftStorageState === 'conflict'}
        type="conflict"
        message={draftConflict?.message || 'Another browser tab has saved changes to this draft. Choose an action to keep your work safe.'}
        onReload={() => resolveConflict('reload')}
        onDuplicate={() => resolveConflict('duplicate')}
        onDismiss={() => {
          setConflictModalOpen(false);
        }}
      />
    </header>
  );
}
