import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function Toast() {
  const { toast, clearToast } = useLabStore();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-quantum-mint" />,
    error: <AlertCircle className="w-4 h-4 text-signal-amber" />,
    info: <Info className="w-4 h-4 text-plasma-cyan" />,
  };

  const borders = {
    success: 'border-quantum-mint/30 bg-quantum-mint/10',
    error: 'border-signal-amber/30 bg-signal-amber/10',
    info: 'border-plasma-cyan/30 bg-plasma-cyan/10',
  };

  return (
    <div role={toast.type === 'error' ? 'alert' : 'status'} className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl bg-obsidian/90 text-sm text-text-primary ${borders[toast.type] || borders.info}`}>
        {icons[toast.type] || icons.info}
        <span className="font-medium text-xs sm:text-sm">{toast.message}</span>
        <button 
          onClick={clearToast}
          className="ml-2 p-1 text-text-muted hover:text-white rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
