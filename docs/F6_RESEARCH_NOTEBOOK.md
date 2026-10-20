# F6 — Local Research Notebook and evidence-backed run comparison

The existing My Experiments page now offers a research notebook. Saved runs can be checked as references, compared by actual recorded validation accuracy, validation loss or training loss, annotated with observations and threats to validity, and used to generate Markdown evidence using the existing `createEvidenceReport` report builder.

Notebook title, notes, limitations, chosen runs and comparison metric are persisted with the existing IndexedDB snapshot service and scoped to the current browser account identity. Saves are explicitly local-only, can fail visibly (quota/private-mode), and are not misrepresented as cloud synchronization.

Run comparison is intentionally evidence-only: a missing metric remains **Not recorded**, and a ranking across different dataset names is flagged as non-comparable. Original run records, training weights, split membership and model parameters are not modified. Exported reports contain run IDs and metrics that were actually recorded.

Tests cover metric selection, numeric zero values, missing measurements, metric ordering and mismatched dataset warnings; desktop/mobile Playwright verifies saving an actual run, notebook persistence across reload, report generation and the no-runs guard.

Future milestones include multi-document notebooks, safer multi-tab revisions, direct notebook-run diff visualizations, project-level sharing and authenticated cloud sync. No AWS or production credentials are part of this change.
