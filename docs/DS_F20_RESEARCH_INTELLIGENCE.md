# F20 — PRISM Research Intelligence

F20 extends the existing **My Experiments** archive and **F15 Model Selection** workspace. It introduces no routes, backend collections or training services. Open **Research Intelligence · Compare Research Runs** to filter saved receipts and select 2–10 runs. Open a run to inspect its archived F15 search evidence, where recorded.

## Chart library

| Saved F14 receipts | Recorded F15 searches |
| --- | --- |
| Validation leaderboard | Fold scores with mean ± sample SD |
| Within-metric performance matrix | Trial × fold heatmap |
| Two-metric trade-off | Actually tested hyperparameter response |
| Signed two-run difference | Complete-trial leaderboard |
| Experiment chronology | Recorded fold support |
| Source/split/pipeline/feature provenance | Separate inner-CV and fixed-validation measurements |
| | Paired trial differences within one search |

Every view uses the shared Chart/Data/Python/JavaScript/Methods surface, CSV and JSON downloads, and SVG/PNG exports in SVG or Canvas mode. A keyboard-accessible evidence table links runs or trials to the existing selection controls. Selecting a chart record never trains or promotes a model.

## Scientific contract

`researchChartSpec.js` builds version-2 PRISM ChartSpecs from explicit `f14-archive`, `f15-live`, or `f15-archived` contexts. Research charts carry a collection snapshot digest and scope digest; `datasetDigest` is null because a saved receipt is not a restored observation dataset. Receipt revisions and original source/split/pipeline/feature fingerprints remain visible in Methods.

The F14 comparison contract checks exact source, split, task, target/class definitions and metric version. F20 additionally checks recorded validation counts across the collection. Different preprocessing or feature schemas are disclosed and can remain comparable. Any incompatible population suppresses rankings and differences. Undefined measurements remain null; equal scores share competition ranks. Matrix colors represent rank within each metric column, never a combined scale across metrics.

F15 summary validation recomputes means and sample SD from recorded fold scores, checks fold counts when available, rejects altered summaries, and excludes incomplete/failed trials from ranking. Historical summaries without fold counts retain their scores but cannot reconstruct support. Paired differences require two complete trials in the same validated search and corresponding fold indices. Sample SD is descriptive; there are no confidence intervals or significance claims.

Charts perform no fitting or prediction. Inner CV, fixed validation and final-test evidence remain separate. Final-test scores never enter research charts or reports; reports include only access timestamps and counts for the audit. CV-versus-validation is explicitly contextual, with no combined ranking.

## Persistence and exports

Unpromoted searches remain ephemeral worker/session state. Promotion uses the original explicit F15→F12 training action. Saving the candidate retains the existing F14 v1 selection summary, which supports archived charts after refresh. Receipt limits remain 30 per owner and 48 KiB each. Archive mutations notify mounted views and other tabs; focus refreshes the local archive. Local browser storage is not cloud durability.

Portable chart and report projections exclude source observations, per-row predictions, fitted weights, neighbor vectors and final-test scores. Python and JavaScript recreate measured plotted evidence; they do not restore datasets, preprocessing, models or training environments. Reports include configurations, fold evidence, compatibility restrictions, revisions, fingerprints, access audit, researcher notes and validity limits. Markdown and JSON report exports use the same validated projection.

## Verification

Five F20 unit suites cover all 13 adapters, numerical summary validation, comparability, request bounds, privacy, archived selection binding and reports. Browser suites cover desktop/mobile archive filtering and selection, all chart families, SVG/Canvas exports, archived evidence and trial linking without implicit training. The maximum-size numerical fixture measures 30 receipts plus 12 trials × 5 folds; this is chart preparation, not a training benchmark.

`scripts/export-python-chart-fixtures.mjs` exports 42 chart programs including all 13 F20 views. CI executes them with `scripts/verify-python-charts.py`. Local generation succeeds; actual Python rendering requires the Python/Matplotlib environment used in CI.

### Recorded local checks

| Check | Result |
| --- | --- |
| Node unit suites | 254 passed |
| Strict client lint and production build | Passed |
| Real MongoDB integration | Passed |
| Full desktop/mobile browser regression | 188 passed in database mode; 188 passed in memory mode |
| Final focused F20 browser coverage | All 10 cases covered in each mode, including archive/search rendering, exports, trial inspection and storage failure |
| Generated Python programs | 42 fixtures generated; Python execution was not performed locally |

The combined database/mobile export-and-refresh flow reached its original 90-second test limit under concurrent browser load. With a 120-second flow limit, its isolated recheck passed in 41 seconds. Rendering retains its separate 15-second acceptance bound.

Across the final desktop/mobile benchmarks in both modes, a 30-receipt archive with 10 selected runs initialized its chart in 338–2,260 ms. The 12-trial/60-fold heatmap initialized in 138–310 ms with SVG and 74–347 ms with Canvas. These are local, hardware-dependent renderer measurements, including module loading where applicable; they are not training benchmarks. JSON evidence is retained under `.artifacts/f20-final-memory` and `.artifacts/f20-final-database`.

Full application visual redesign, custom AutoML, nested CV, inferential statistics, cloud tracking and source/environment restoration remain outside F20.
