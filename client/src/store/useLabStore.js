import { create } from 'zustand';
import { snapshot, transition } from '../../../shared/domain.mjs';

export const useLabStore = create((set) => ({
  cloudSyncState: 'idle',
  setCloudSyncState: cloudSyncState => set({cloudSyncState}),
  activeRun: null,
  savedRun: null,
  pendingRun: null,
  draftState: { dirty: false, revision: 0, sync: 'unsaved' },
  draftStorageState: 'pristine', // 'pristine' | 'pending' | 'saving' | 'saved_local' | 'conflict' | 'failed'
  setDraftStorageState: (status) => set({ draftStorageState: status }),
  draftConflict: null,
  setDraftConflict: (conflict) => set({ draftConflict: conflict }),
  activeDraftId: 'draft-default',
  setActiveDraftId: (id) => set({ activeDraftId: id }),
  execution: null,
  inspection: { checkpoint: null },
  setInspection: (checkpoint) => set({ inspection: { checkpoint } }),
  saveConfirmation: null,
  parentRunId: null,

  setActiveRun: (run) => set(state => ({ activeRun: run ? snapshot({ ...run, runId: crypto.randomUUID(), completedAt: new Date().toISOString(), parentRunId: state.parentRunId }) : null, savedRun: null, saveConfirmation: null })),
  setSavedRun: (run) => set(state => ({ savedRun: snapshot(run), saveConfirmation: { storage: run.storage, at: new Date().toISOString() }, draftState: { ...state.draftState, dirty: false, sync: run.storage === 'local' ? 'local' : 'saved' }, currentExperiment: {...state.currentExperiment,id:run._id,lastSaved:new Date().toISOString(),isDirty:false} })),
  loadRun: (run) => set({ pendingRun: snapshot(run), parentRunId: run.domain?.run.id ?? run.runId ?? run._id ?? null, activeRun: null, savedRun: null, inspection: { checkpoint: null }, saveConfirmation: null }),
  clearPendingRun: () => set({ pendingRun: null }),
  // Navigation & Shell
  sidebarExpanded: true,
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

  // Command Palette
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  // Active Experiment Context
  currentExperiment: {
    id: 'exp-demo-01',
    name: 'Untitled Experiment',
    status: 'Ready', // 'Ready' | 'Inputs changed' | 'Running' | 'Completed' | 'Needs attention'
    lastSaved: 'Just now',
    isDirty: false,
  },
  setExperimentStatus: (status) => set((state) => {
    let execution = state.execution;
    if (status === 'Running' && execution?.state !== 'running') {
      execution = transition(transition({ id: crypto.randomUUID(), state: 'queued' }, 'validating'), 'running');
    }
    const next = { Stopping: 'stopping', Stopped: 'cancelled', Failed: 'failed', Completed: 'completed', Interrupted: 'interrupted' }[status];
    if (next && execution && execution.state !== next && ['running', 'stopping', 'validating'].includes(execution.state)) execution = transition(execution, next);
    const changed = status === 'Inputs changed';
    return { execution, draftState: changed ? { ...state.draftState, dirty: true, revision: state.draftState.revision + 1, sync: 'unsaved' } : state.draftState,
      currentExperiment: { ...state.currentExperiment, status, ...(changed ? { isDirty: true } : {}) } };
  }),
  setExperimentName: (name) => set((state) => ({
    draftState: { ...state.draftState, dirty: true, revision: state.draftState.revision + 1, sync: 'unsaved' },
    currentExperiment: { ...state.currentExperiment, name, isDirty: true }
  })),

  // Notification Toast & History
  toast: null,
  notifications: [],
  notificationDrawerOpen: false,
  setNotificationDrawerOpen: (open) => set({ notificationDrawerOpen: open }),
  toggleNotificationDrawer: () => set((state) => ({ notificationDrawerOpen: !state.notificationDrawerOpen })),
  showToast: (message, type = 'info') => {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `notif-${Date.now()}-${Math.random()}`;
    const newNotif = {
      id,
      title: type === 'error' ? 'Error' : type === 'warning' ? 'Attention' : type === 'success' ? 'Success' : 'Notification',
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };
    set((state) => ({
      toast: { message, type },
      notifications: [newNotif, ...state.notifications].slice(0, 50)
    }));
    setTimeout(() => {
      set((state) => (state.toast?.message === message ? { toast: null } : {}));
    }, 3000);
  },
  clearToast: () => set({ toast: null }),
  markAllNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true }))
  })),
  clearNotifications: () => set({ notifications: [] }),

  // Phase 2 Workspace State: View Mode (Guided vs Expert)
  viewMode: (typeof window !== 'undefined' && window.localStorage?.getItem('neuroforge_view_mode')) || 'expert',
  setViewMode: (mode) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.setItem('neuroforge_view_mode', mode); } catch { /* ignore */ }
    }
    set({ viewMode: mode });
  },
  toggleViewMode: () => set((state) => {
    const next = state.viewMode === 'guided' ? 'expert' : 'guided';
    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.setItem('neuroforge_view_mode', next); } catch { /* ignore */ }
    }
    return { viewMode: next };
  }),

  // Focus Mode (Canvas maximization)
  focusMode: false,
  setFocusMode: (focus) => set({ focusMode: focus }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  // Persistent Panel Layouts
  panelLayouts: {
    leftPanelWidth: 320,
    rightPanelWidth: 320,
    bottomDockHeight: 208,
    leftCollapsed: false,
    rightCollapsed: false,
    bottomCollapsed: false,
  },
  setPanelLayout: (key, value) => set((state) => {
    const next = { ...state.panelLayouts, [key]: value };
    if (typeof window !== 'undefined' && window.localStorage) {
      try { window.localStorage.setItem('neuroforge_panel_layouts', JSON.stringify(next)); } catch { /* ignore */ }
    }
    return { panelLayouts: next };
  }),


  // Unified Context Inspector State
  selectedContext: null, // { type: 'sample' | 'layer' | 'neuron' | 'metric' | 'run', data: any }
  setSelectedContext: (context) => set({ selectedContext: context }),
  clearSelectedContext: () => set({ selectedContext: null }),

  // Linked Cursor State for synchronized inspection across charts & views
  linkedCursor: null, // { step: number, epoch: number, metric: string, source: string }
  setLinkedCursor: (cursor) => set({ linkedCursor: cursor }),
  clearLinkedCursor: () => set({ linkedCursor: null }),
}));
