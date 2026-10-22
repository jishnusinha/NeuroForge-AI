import {lazy,Suspense,useState} from 'react';
const CodeCompanion=lazy(()=>import('./CodeCompanion.jsx'));
export default function CodeCompanionEntry({context,evidence}){const [open,setOpen]=useState(false);return <details className="prism-ui-card prism-code-companion-entry" onToggle={event=>setOpen(event.currentTarget.open)}><summary>F22 — ML / DL Code Companion</summary>{open&&<Suspense fallback={<p role="status">Loading reviewed code templates…</p>}><CodeCompanion context={context} evidence={evidence}/></Suspense>}</details>;}
