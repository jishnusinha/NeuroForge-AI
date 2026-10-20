import { useState } from 'react';
import { buildEdaReport, edaReportMarkdown } from '../../../ml/edaEvidence.js';

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EdaReportPanel({ source, filteredRows, filters, sourceName, onCreateSubset }) {
  const [notes, setNotes] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const exportReport = async format => {
    setState('Generating evidence report...');
    setError('');
    try {
      const report = await buildEdaReport(source, filters, notes, sourceName);
      if (format === 'json') download(JSON.stringify(report, null, 2), 'neuroforge-eda.json', 'application/json');
      else download(edaReportMarkdown(report), 'neuroforge-eda.md', 'text/markdown');
      setState('Evidence report exported (no source observations included).');
    } catch (reason) {
      setState('');
      setError(reason.message);
    }
  };
  return <section aria-label="EDA evidence and notes" className="space-y-4">
    <div>
      <h5 className="text-lg font-semibold">Investigation evidence</h5>
      <p className="mt-1 text-sm text-text-muted">Record your interpretation and export a reproducibility receipt with dataset SHA-256, filters, statistical methods and quality findings. Raw observations are excluded.</p>
    </div>
    <label className="block text-sm font-medium">Research observations and limitations
      <textarea aria-label="EDA research observations" rows={5} maxLength={4000} value={notes} onChange={event=>setNotes(event.target.value)}
        placeholder="Describe the question, evidence, uncertainties and next experiments."
        className="mt-2 w-full rounded-xl border border-white/20 bg-obsidian p-3 text-text-primary"/>
    </label>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>exportReport('md')} className="min-h-11 rounded-lg bg-plasma-cyan px-4 text-sm font-semibold text-ink-on-accent">Export Markdown</button>
      <button type="button" onClick={()=>exportReport('json')} className="min-h-11 rounded-lg border border-white/20 bg-obsidian px-4 text-sm">Export JSON</button>
    </div>
    <div className="rounded-xl border border-white/10 bg-obsidian p-3 space-y-2">
      <h5 className="font-semibold">Create a preparation subset</h5>
      <p className="text-sm text-text-muted">Explicitly replace the current preparation input with the {filteredRows.length} filtered original rows. A new dataset copy will be created; the source values remain unchanged. Supported 2-feature binary modeling restrictions still apply.</p>
      <button type="button" disabled={!filters.length || filteredRows.length<4 || !onCreateSubset}
        onClick={()=>onCreateSubset(filteredRows)}
        className="min-h-11 rounded-lg border border-plasma-cyan/40 bg-plasma-cyan/10 px-4 text-sm font-semibold text-plasma-cyan disabled:opacity-40">
        Use filtered rows for preparation
      </button>
      {filteredRows.length<4 && <p className="text-xs text-signal-amber">At least four records are needed to create an import-compatible subset.</p>}
    </div>
    {state && <p role="status" className="text-sm text-quantum-mint">{state}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </section>;
}
