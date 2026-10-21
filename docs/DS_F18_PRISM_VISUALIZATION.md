# F18 — PRISM Scientific Visualization Studio

F18 extends F16 charts and connects F17 DataSheet selections to measured EDA and frozen F11 preprocessing evidence. Open **Chart Studio** in Dataset Explorer, use **Chart selected cells / Chart current sheet view** in DataSheet, or expand **Visualize fitted preprocessing** in the advanced pipeline workspace.

## Supported views

The 17 EDA views are histogram, KDE, box, violin, ECDF, categorical count, scatter, scatter matrix, hexbin, OLS trend, correlation heatmap, correlation ranking, missingness matrix, completeness, column quality, data types, and duplicates. Pearson and Spearman use F10 calculations with pairwise finite observations. Undefined correlations remain unavailable rather than becoming zero.

The eight pipeline views cover before/after distributions, missingness and imputation, observed scaling ranges, feature expansion, lineage, split composition, fitted statistics, and dropped/invalid values. `replayFittedStages` applies existing frozen node parameters; it never fits preprocessing or creates a new split. Validation/test views use training-fitted parameters. Viewing charts does not score models or unlock final-test evaluation.

## Evidence and limits

`chartSpecV2.js` validates configuration, source/scope digests, pipeline identity, typed evidence, and finite statistics. Family adapters produce evidence and rendering instructions; rendering does not calculate statistics. F16 ChartSpec v1 remains supported and histogram evidence is checked for equivalence.

The existing 2,000-row budget remains. Scatter matrices allow four columns; grouped distributions allow eight groups; categorical counts retain the top twelve categories plus a combined remainder. Missingness matrices systematically sample at most 80 rows and label the sampling; column counts still use the full chosen population. Evidence is bounded to 40,000 rows, 32 columns, and a 6 MiB specification.

Histogram groups share population bin edges. Quartiles use linear interpolation and box whiskers use observed values within 1.5 IQR. KDE uses a documented Gaussian kernel, 96 grid samples, and explicit or documented automatic bandwidth; insufficient/constant samples are reported. ECDF ties are combined with right-continuous fractions. OLS reports fitted coefficients without uncertainty bands. Method panels expose the parameters and exclusions for each chart.

## Linked DataSheet behavior

Source, filtered view, selection, working copy, and prepared pipeline populations are labeled separately. Stable row IDs connect pointer brushing and keyboard data-table controls to DataSheet highlights. Missingness links can explicitly create a missing-value filter. Opening a chart preserves the source dataset and the sheet's selection state.

Working-copy charts use edited values and carry a visible label. Preparation still requires committing a dataset version. Restoring a chart verifies the source, ordered row scope, and fitted artifact identity; stale scopes cannot silently become a different population.

## Reproduction and exports

Every chart provides Chart, Data, Python, JavaScript, and Methods panels. Users can copy code, download Python, export chart JSON and exact plotted CSV, and export SVG/PNG with either renderer. Generated Python reads the accompanying JSON/CSV, verifies the saved evidence, and draws that evidence. JavaScript uses the saved ECharts option with ECharts installed in a bundler environment; serve exported files over HTTP for `fetch`.

These scripts reproduce plotted data. They do not rerun the analysis or fit preprocessing. Observation-level charts require explicit consent for full evidence/data/image exports; their default JSON contains metadata only. Separate source CSV and typed source JSON exports are also opt-in. Public exports omit internal row IDs. Spreadsheet-safe CSV escaping is documented in the export manifest and decoded by Python; typed source JSON preserves primitive values without CSV coercion.

Python scripts are generated and checked by domain tests, but were not executed in this environment because no Python runtime is installed.

## Rendering and persistence

ECharts 6.1 is loaded by family when a chart is opened. SVG is the default for smaller evidence and Canvas for more than 4,000 evidence rows; the renderer can be switched. Charts observe container size, follow light/dark themes, and dispose on surface changes and unmount. Mobile scatter matrices scroll horizontally, while a separate paginated data table supports keyboard access. Homepage and unopened chart panels do not load the studio renderer.

Saved chart configurations are local and owner scoped in IndexedDB, with revision conflict detection and visible storage failures. Limits are 20 configurations per owner, 128 KiB per record, 2 MiB for chart configurations, and the existing 10 MiB origin soft budget. Configurations store settings, digests, and private row scope, without observation values.

## Verification

`tests/prism-visualization-f18.test.mjs` covers adapters, numerical fixtures, source/scope validation, privacy gates, stable links, and frozen pipeline replay. `tests/e2e/prism-studio-f18.spec.mjs` covers every chart family, desktop/mobile links, real pointer brushing, SVG/Canvas exports and disposal, working copies, saved configuration recovery, and a 2,000-row render benchmark. The benchmark records initialization timing and screenshots in Playwright attachments and asserts a 15-second ceiling.

Final verification on 2026-10-21 passed 217 unit tests, lint, the production build, MongoDB integration, and both complete browser suites: 166 tests with MongoDB and 166 in memory mode, with no failures or skips. The benchmark measured chart initialization after adapter computation; these are local observations under concurrent suites, not end-to-end upload timings or cross-device performance guarantees.

| Storage mode | Viewport | SVG initialization | Canvas initialization |
| --- | --- | ---: | ---: |
| MongoDB | Desktop | 494.5 ms | 402.2 ms |
| MongoDB | Mobile | 430.3 ms | 131.3 ms |
| Memory | Desktop | 833.9 ms | 208.4 ms |
| Memory | Mobile | 452.8 ms | 190.7 ms |

Reports and attachments are recorded under `.artifacts/e2e-database` and `.artifacts/e2e-memory`; `.artifacts/verification-summary.json` records the combined suite result. The final mobile Canvas screenshot was visually inspected for readable axes.

Library references: [modular imports](https://echarts.apache.org/handbook/en/basics/import/) and [Canvas versus SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/).
