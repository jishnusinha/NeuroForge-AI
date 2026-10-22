export function EvidenceLayout({children,inspector}){return <div className="prism-ui-evidence-layout"><div className="min-w-0">{children}</div>{inspector}</div>;}
export function WorkspaceToolbar({label,children}){return <div role="group" aria-label={label} className="prism-ui-toolbar">{children}</div>;}
export function ScientificInspector({title='Research context',children}){return <aside className="prism-ui-inspector" aria-label={title}><h3>{title}</h3>{children}</aside>;}
