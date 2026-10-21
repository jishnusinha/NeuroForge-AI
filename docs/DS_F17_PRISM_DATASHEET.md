# F17 - PRISM DataSheet

Dataset Explorer now includes the complete bounded DataSheet workflow, extending the F17.0 virtual grid through analytical interactions, safe working copies and local dataset versions.

## Analytical workspace (F17.0 / F17.1)

The existing dependency-free React grid retains two-axis virtualization, frozen column headers and row numbers, resizing, accessible cell roles, keyboard navigation and stable source row IDs. The original Row Explorer remains available.

Use search for values or column names. Click a column name to sort; Shift-click adds sort priorities. F10 typed filters apply to the sheet. Shift-click or Shift+arrows selects ranges. Selected cells are tracked by original row ID and column name, including after sorting. Copy produces TSV in displayed order, preserving missing cells; filtered CSV export includes column headers. Formula-like categorical strings are escaped for spreadsheet safety. Values are always rendered literally and never evaluated.

The value inspector, selected-range count/missing/numeric/sum/mean statistics and selected-column profile use the actual displayed data. Analyze visible rows / Chart explicitly hands the population to the F10 distribution/PRISM chart view. Clear DataSheet analysis scope restores the ordinary F10 population. Edited values require a committed version before entering analysis or preparation.

## Safe working copies (F17.2)

Create working copy enables the value editor, missing-value clearing, rectangular TSV paste, fill down/right and undo/redo. The source dataset stays immutable. Numeric columns require finite decimal/scientific values; categorical columns preserve strings, including numeric-looking strings. Mixed numeric source cells retain numeric validation even after clearing. Empty input explicitly creates a missing value. Quoted TSV supports tabs, quotes and newlines.

Every paste or fill validates completely before changing state and creates one history entry. Undo/redo retain up to 50 transactions. Ctrl/Command+Z, Ctrl/Command+Y and Ctrl/Command+Shift+Z work in the focused grid; F2 focuses the value editor and Enter applies its value. Review changes displays each source ID, column and before/after value.

Draft edits survive view changes within the workbench. Save draft locally explicitly persists them; unsaved edits have a browser unload warning. No autosave success is implied. Export working copy downloads a typed JSON bundle; import can restore that bundle from Dataset Explorer or replace the current working copy against exactly the same source.

## Dataset versions and recovery (F17.3)

Save draft locally and Commit new dataset version use a dedicated IndexedDB database, NeuroForgeDataSheets, independent of the small F14 receipt API. Records contain the full immutable source and working copy. Saved DataSheets can be recovered, reopened, refreshed or deleted from Dataset Explorer after a browser refresh.

The repository scopes keys to neuroforge_account_id (or guest), validates stable schema/row order, uses atomic read/compare/write revision checks, and acknowledges saves only on transaction completion. Cross-tab stale writers receive F17_REVISION_CONFLICT. Identity changes cancel saves. Storage failure and quota errors remain visible. There is no silent in-memory durability fallback.

Bounds: 2,000 rows, 20 columns and a 2 MiB serialized sheet budget, at most eight records per owner, and the existing global 10 MiB local-storage soft limit. Navigator storage estimates also check available origin quota. Source plus working copy overhead counts toward the repository budget. Export and delete older work to free capacity.

Commit requires real changes and produces a fresh UUID, SHA-256 content fingerprint, parent fingerprint, timestamp and changed-cell count. It copies only dataset values and new provenance, excluding old fitted pipelines, evaluation scores and folds. Dataset Explorer remounts preparation with fresh defaults and refits all preparation stages. Both basic and F11 lab handoffs carry the provenance and include the full source-version fingerprint in preprocessing identity, so even an edit outside the chosen features changes research identity. Previously saved research remains associated with its original dataset.

## Implementation and verification

- ml/datasheet/gridModel.js: bounded grid geometry and navigation.
- ml/datasheet/transactions.js: typed transactions, clipboard parsing, safe exports, stable range statistics, immutable commits and fingerprints.
- services/datasetVersionRepository.js: dedicated bounded, owner-scoped IndexedDB persistence.
- components/workspace/datasheet/DataSheetWorkspace.jsx: analytical controls, working-copy history, review, recovery and explicit handoffs.
- Existing F17.0 domain/browser tests retain maximum-size virtualization and source-ID coverage.
- New domain tests cover validation, atomic rollback, typed missing values, TSV quoting, injection-safe export, selection statistics and version identity.
- New desktop/mobile browser tests cover paste rollback, undo/redo, fill, JSON round trips, refresh recovery, conflict detection, owner isolation, quota errors and version commitment.

Full Excel formulas, macros, pivot tables and XLSX fidelity are outside F17. This implementation adds no grid library or remote data-upload dependency.
