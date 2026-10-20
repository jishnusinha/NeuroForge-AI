import React from 'react';
import { AlertTriangle, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';

export default function DraftRecoveryModal({
  isOpen,
  type = 'interrupted', // 'interrupted' | 'conflict'
  message = '',
  onReload,
  onDuplicate,
  onDismiss,
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
    >
      <div className="w-full max-w-md bg-[#0D1422] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col space-y-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#F3B65E]/15 border border-[#F3B65E]/30 text-[#F3B65E]">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="recovery-modal-title" className="text-sm font-semibold text-white">
              {type === 'conflict' ? 'Cross-Tab Revision Conflict' : 'Interrupted Session Detected'}
            </h3>
            <span className="text-[11px] text-[#9EACC4]">Data integrity safeguard</span>
          </div>
        </div>

        <p className="text-[#9EACC4] leading-relaxed">
          {message || (type === 'conflict' 
            ? 'Another open browser tab has saved changes to this draft. To prevent overwriting work, choose whether to reload the latest version or fork a copy.' 
            : 'Your previous training session was interrupted (e.g. tab refresh or browser exit). The model configuration was restored safely without inventing completed metrics.')}
        </p>

        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/5">
          {type === 'conflict' ? (
            <>
              <button
                type="button"
                onClick={onDuplicate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-[#46D7F2]" />
                <span>Save as Copy</span>
              </button>
              <button
                type="button"
                onClick={onReload}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#46D7F2] text-[#080D18] font-bold transition-colors hover:opacity-90"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Latest</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3CD5AA] text-[#080D18] font-bold transition-colors hover:opacity-90"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Acknowledge & Continue</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
