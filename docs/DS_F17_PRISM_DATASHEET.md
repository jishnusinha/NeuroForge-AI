# DS-F17.0 — PRISM DataSheet Foundation

F17.0 introduces an Excel-like **read-only DataSheet** inside Dataset Explorer → Data Science Workbench → DataSheet. This is the first of four scoped F17 releases, not a claim of full spreadsheet editing, XLSX fidelity, formula engines or workbook persistence.

## What ships

- **Two-axis virtualization:** independently mount only visible observation rows and columns plus bounded overscan, supporting the existing 2,000-row / 20-column importer and 2 MiB CSV budget. Mounted counts are visible in the footer; 40,000 DOM cells are not created.
- A theme-derived PRISM scientific surface with real column letters A–T, frozen headers and row numbers, type badges, draggable column widths, missing-value display, a formula-style cell inspector, an observation-ID inspector, and a responsive scroll container.
- **Keyboard navigation:** Arrow keys, Home/End, Ctrl/Command+Home/End, PageUp/PageDown, Tab/Shift+Tab and Enter/Shift+Enter, with automated viewport scrolling for active cells.
- **Stable source selection:** cells are selected by original observation `id` and original column name, not by transient visible row position. The DataSheet can open the original row in the existing Row Explorer; reentering the sheet retains the selected ID.
- **F10 integration:** F10 filters supply the visible row population. Neither the DataSheet nor the chart/ML engines mutate the imported dataset. The existing row explorer, dataset evidence/report, PRISM histogram, F11 preparation and F12–F15 downstream systems remain unchanged.
- Accessible `grid` roles, known row/column counts, active-descendant and selected-cell metadata, column/row headers, keyboard help, and text inspector. On small screens, swipe/scroll horizontally to inspect further columns.

## Implementation choice and dependency assessment

The F17 plan proposed evaluating the MIT-licensed React Data Grid, which is attractive for spreadsheet editing and keyboard tooling. For **this first read-only slice**, we use a small **dependency-free React virtual grid** instead:

- The present source limit is only 2,000 × 20.
- The source schema and observation identity rules are already well defined.
- The design requires predictable F10 filtered-row identity and no implicit changes to source data.
- A new grid dependency and package-lock migration would expand the risk of the initial release.
- The pure geometry and navigation functions can be independently tested at exact maximum dimensions.

This does **not** settle the final spreadsheet-editing library decision. During F17.1/F17.2, compare the existing virtual grid against React Data Grid for robust range selection, complex clipboard/paste, touch behavior, editing and maintainability. If migrating, keep the pure domain contract and F10 source identity rules intact.

## Source and viewport contract

`client/src/ml/datasheet/gridModel.js` provides:

- `validateDataSheet(dataset)`: validates bounded headers, stable unique original row IDs, and source cell kinds. No coercion or mutation.
- `columnLetter(index)` and `cellAddress(rowIndex,columnIndex)`: Excel-style **display** positions A1–T2000. Addresses reflect filtered view positions, not source identities.
- `columnKinds(dataset)`: observed numeric/categorical/mixed/empty metadata and missing counts without fitting preprocessing.
- `normalizeColumnWidths`: 110–360 pixel constrained widths.
- `gridViewport`: deterministic visible row/column window, offsets and full scroll dimensions.
- `moveSheetCell`: bounded navigation, including Tab wrapping and first/last jumps.

The grid renders source data **as literal text** with no `innerHTML`, `eval`, formulas or source transformations. Missing cells show as `Missing`. Original row IDs are displayed independently in the inspector and passed to F10's existing row-inspection handler.

F17.0 uses the active F10 filter result. The existing Row Explorer remains as a separate tab with its own sorting/pagination. Sorting, additional DataSheet search, multi-cell range selection, copy, paste, editing and filtered CSV exports are deliberately deferred.

## Source safety and training separation

- DataSheet is `aria-readonly="true"` and supplies **no cell-edit mutation path**.
- Selecting/scrolling cells never changes F11 source data, F12 fits, F13 explanations, F14 receipts or F15 fold memberships.
- F10 filters change displayed row membership; they do **not** modify the imported dataset.
- F17.0 makes **no IndexedDB schema, API or server changes** and does not save any source rows to remote services.
- A selected address A17 is view-relative; a stable ID such as `sample-19` is source-relative. They must not be conflated.
- F17.2/F17.3 will introduce explicit immutable working copies and versioned commit semantics before enabling editing or durable drafts.

## Files

| File | Role |
|---|---|
| `client/src/ml/datasheet/gridModel.js` | Read-only schema, viewport geometry, keyboard navigation and column type rules |
| `client/src/components/workspace/datasheet/DataSheet.jsx` | PRISM virtual grid, sticky headers, resizing, active cell, inspector and navigation |
| `client/src/components/workspace/DataScienceWorkbench.jsx` | Additional DataSheet tab and selection bridge into legacy F10 Row Explorer |
| `client/src/index.css` | Scoped theme-aware DataSheet styles, responsive view, reduced motion |
| `tests/prism-datasheet-f17.test.mjs` | Source validation, 2,000×20 viewport, keyboard, filters, missing values and immutability |
| `tests/e2e/prism-datasheet-f17.spec.mjs` | Browser navigation, original IDs, F10 filtered scope, last cell virtualization and missing observations |

## Verification gates

The PR must pass `npm run check`, `npm run test:e2e:memory` and `npm run baseline:summary` on both push and PR-triggered GitHub Actions before leaving draft.

Include desktop/mobile E2E checks for viewport virtualization and keyboard navigation. Verify no old F2/F10/F11/F12/F13/F14/F15 workflows regress.

## Remaining F17 roadmap

1. **F17.1 — Analytical Spreadsheet:** quick search, multi-column sorting, range selection/copy, column profiles, filtered CSV export and chart handoff, preserving F10 filter source semantics.
2. **F17.2 — Safe Editing:** opt-in working copy, typed validation, atomic paste, fill, undo/redo and full edit review.
3. **F17.3 — Dataset Versions:** owner-scoped persisted drafts, conflict detection, explicit new version fingerprints and carefully controlled F11/F12/F15 handoff.

No future capability in this section should be described as shipped in F17.0.
