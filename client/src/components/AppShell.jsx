import { syncOutbox } from '../services/syncManager.js';
import { isFeatureEnabled } from '../services/productionConfig.js';
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import WorkspaceHeader from './WorkspaceHeader';
import CommandPalette from './CommandPalette';
import Toast from './Toast';
import NotificationDrawer from './workspace/NotificationDrawer';
const ActivityDrawer = lazy(() => import('./workspace/ActivityDrawer'));
import { useLabStore } from '../store/useLabStore';

import { draftManager } from '../services/draftManager';

let recoveryChecked = false;
export default function AppShell() {
  const execution = useLabStore(state=>state.execution);
  const location = useLocation();
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState(undefined);
  const [checked,setChecked]=useState(recoveryChecked);
  const isLab=['/app/playground','/app/studio'].includes(location.pathname);
  const loadRun = useLabStore(state => state.loadRun);
  const {
    sidebarExpanded,
    focusMode,
    toggleFocusMode,
    toggleViewMode,
    toggleNotificationDrawer,
    setDraftStorageState,
    setDraftConflict,
    showToast
  } = useLabStore();
  const isLandingPage = location.pathname === '/';

  useEffect(()=>{
    if(!isFeatureEnabled('accounts_and_sync'))return;
    const sync=()=>{if(navigator.onLine)syncOutbox().then(count=>{if(count)useLabStore.getState().setCloudSyncState('saved');}).catch(error=>useLabStore.getState().setCloudSyncState(error.message.toLowerCase().includes('conflict')?'conflict':'pending'));};
    const unsubscribe=draftManager.subscribe(state=>{if(state.status==='saved_local')sync();});
    const online=()=>syncOutbox({force:true}).catch(()=>{});
    window.addEventListener('online',online);const interval=setInterval(sync,30000);sync();
    return()=>{unsubscribe();clearInterval(interval);window.removeEventListener('online',online);};
  },[]);
  // Global Workspace Keyboard Shortcuts: Alt+F (Focus), Alt+V (View Mode), Alt+N (Notifications)
  useEffect(() => {
    if (!isFeatureEnabled('workspace_system')) return;
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        toggleFocusMode();
      } else if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        toggleViewMode();
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        toggleNotificationDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode, toggleViewMode, toggleNotificationDrawer]);

  // Subscribe to DraftManager autosave and cross-tab conflict states, plus startup recovery check
  useEffect(() => {
    const unsubscribe = draftManager.subscribe((state) => {
      setDraftStorageState(state.status);
      if (state.status === 'conflict') {
        setDraftConflict({ message: state.lastError });
      }
    });

    let alive = true;
    if (isLab) {
      const check=async()=>{
        const result=await (recoveryChecked || useLabStore.getState().pendingRun ? Promise.resolve({hasRecovery:false}) : draftManager.checkRecoveryOnStartup());
        if(alive){recoveryChecked=true;setChecked(true);setRecovery(result.hasRecovery?result:null);}
      };
      check().catch(error=>{if(alive){recoveryChecked=true;setChecked(true);setRecovery(null);showToast(error.message,'error');}});
    }

    return () => { alive = false; unsubscribe(); };
  }, [setDraftStorageState, setDraftConflict, showToast, isLab, location.pathname]);


  const restore = async () => {
    const draft = recovery.draft;
    loadRun({ ...draft.configuration, workspace: draft.workspace, _draftId: draft.id, _draftRevision: draft.revision });
    await draftManager.dismissRecovery();
    navigate('/app/' + draft.workspace); setRecovery(null);
    if (recovery.wasInterrupted) showToast('Draft restored. Previous training was interrupted; start a new run.', 'info');
  };
  if (isLab && (recovery === undefined || !checked)) return <p role="status" className="p-8">Checking saved drafts?</p>;
  if (isLab && recovery) return <div role="dialog" aria-modal="true" aria-label="Recover draft" className="p-8 bg-[#080D18] min-h-screen text-white space-y-4"><h2>Recover your last draft</h2><p>{recovery.legacyIncomplete ? 'The older draft stored settings but omitted dataset rows. Restoring creates a copy with those settings and newly generated default data; the original record is retained.' : recovery.wasInterrupted ? 'Training was interrupted. Configuration is available; completed metrics will not be invented.' : 'A saved draft is available on this device.'}</p><button autoFocus className="p-3 bg-cyan-800 rounded" onClick={() => restore().catch(error => showToast(error.message,'error'))}>Restore draft</button><button className="p-3" onClick={() => draftManager.dismissRecovery().then(() => setRecovery(null)).catch(error => showToast(error.message,'error'))}>Start fresh</button></div>;

  // Landing page has its own standalone public layout
  if (isLandingPage) {
    return (
      <div className="min-h-screen bg-[#080D18] text-[#F2F5FC]">
        <CommandPalette />
        <Toast />
        {isFeatureEnabled('workspace_system') && <NotificationDrawer />}
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080D18] text-[#F2F5FC] flex flex-col font-sans">
      <button
        type="button"
        onClick={() => document.getElementById('main-content')?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-[#46D7F2] focus:px-4 focus:py-2 focus:text-[#080D18] focus:font-semibold"
      >
        Skip to main content
      </button>
      <CommandPalette />
      <Toast />
      <NotificationDrawer />
      {execution && <Suspense fallback={null}><ActivityDrawer /></Suspense>}
      {!focusMode && <Sidebar />}


      {/* Main Workspace Frame */}
      <div
        className={`neuroforge-app-frame min-w-0 w-full flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          focusMode ? 'pl-0' : (sidebarExpanded ? 'lg:pl-[232px]' : 'lg:pl-[72px]')
        }`}
      >
        <WorkspaceHeader />
        {import.meta.env?.VITE_STATIC_DEMO === 'true' && (
          <div role="status" className="border-b border-amber-400/20 bg-amber-400/5 px-4 py-2 text-xs text-amber-100">
            Public browser-only demo: training and local drafts work here. Cloud accounts, cross-device sync and shareable server reports need the separately deployed API. Do not enter sensitive data.
          </div>
        )}

        {/* Workspace Canvas / Viewport */}
        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col overflow-x-hidden bg-[#080D18]">
          <Outlet key={location.key} />
        </main>
      </div>
    </div>
  );
}
