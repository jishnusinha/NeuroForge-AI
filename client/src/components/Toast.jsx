import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useLabStore } from '../store/useLabStore';

export default function Toast() {
  const { toast, clearToast } = useLabStore();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-[#3CD5AA]" />,
    error: <AlertCircle className="w-4 h-4 text-[#F3B65E]" />,
    info: <Info className="w-4 h-4 text-[#46D7F2]" />,
  };

  const borders = {
    success: 'border-[#3CD5AA]/30 bg-[#3CD5AA]/10',
    error: 'border-[#F3B65E]/30 bg-[#F3B65E]/10',
    info: 'border-[#46D7F2]/30 bg-[#46D7F2]/10',
  };

  return (
    <div role={toast.type === 'error' ? 'alert' : 'status'} className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl bg-[#151E30]/90 text-sm text-[#F2F5FC] ${borders[toast.type] || borders.info}`}>
        {icons[toast.type] || icons.info}
        <span className="font-medium text-xs sm:text-sm">{toast.message}</span>
        <button 
          onClick={clearToast}
          className="ml-2 p-1 text-[#9EACC4] hover:text-white rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
