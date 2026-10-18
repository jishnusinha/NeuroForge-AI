import { create } from 'zustand';

export const useLabStore = create((set) => ({
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
    name: 'XOR Non-Linearity Benchmark',
    status: 'Ready', // 'Ready' | 'Inputs changed' | 'Running' | 'Completed' | 'Needs attention'
    lastSaved: 'Just now',
    isDirty: false,
  },
  setExperimentStatus: (status) => set((state) => ({
    currentExperiment: { ...state.currentExperiment, status }
  })),
  setExperimentName: (name) => set((state) => ({
    currentExperiment: { ...state.currentExperiment, name, isDirty: true }
  })),

  // Notification Toast
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set({ toast: null });
    }, 3000);
  },
  clearToast: () => set({ toast: null }),
}));
