# F1 — Evidence accessibility: charts, docks, and metric tables

## Completed scope

- **Experiment Arena:** toggle comparison chart and accessible scrollable data table. The table displays exact recorded epochs and Baseline/Variant Train/Validation measurements. Missing measurements remain `Not recorded` rather than being interpolated or inferred. Epoch buttons update synchronized timeline selection. The chart now separates path segments across unavailable or unrecorded epochs.
- **ML Playground:** toggle graphical history bars and an inspectable table of recorded epochs/iterations and their real loss/inertia values. Models without iterative history show a clear empty state.
- **Playground and Neural Studio:** replace click-only dock headings with named, keyboard-operable collapse/expand buttons exposing `aria-expanded`.
- **Studio metric charts:** expose table toggle pressed state and add descriptive captions and scoped table headers.

## Scientific / accessibility boundaries

The numeric ML engines, evaluation splits, training state, experiments and persisted data are unchanged. No backend, AWS, identity, or production credentials are touched.

Unit tests verify exact epoch alignment, recorded zeros, missing measurement handling and chart discontinuities. Browser tests exercise chart/table toggles, keyboard accessibility, saved experiment comparisons and dock collapse/expand at desktop and mobile sizes.

The F1 work is not a full WCAG certification; next accessibility tasks include keyboard manipulation of data points on the Canvas and physical-device / assistive-technology audits.

## Merge gates

Verify Node tests, lint, MongoDB integration, database-backed browser tests and memory-mode browser tests pass. Keep GitHub Pages on `master` until the PR is reviewed and merged.
