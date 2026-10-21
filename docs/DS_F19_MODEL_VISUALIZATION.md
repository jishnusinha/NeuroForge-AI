# F19 — PRISM Model Evaluation and Visual Explainability

F19 lives in Dataset Explorer → Advanced Pipeline Studio → F12 Model Workbench. Train a candidate, then expand **F19 — Model Evaluation Studio**. Inside F13, select or calculate an explanation and expand **F19 — Visual Explainability**. Existing numerical tables remain available. No new top-level page is introduced.

## Delivered scope

| Area | Views and evidence |
| --- | --- |
| Regression | Actual versus predicted with identity line; signed residuals versus fitted values with zero line; residual histogram; mean absolute error by actual target range |
| Classification | True-row/predicted-column confusion counts or row fractions; per-class precision, recall, F1, and support |
| Recorded probabilities | Selected-class one-vs-rest ROC/AUC, precision–recall/average precision, reliability bins/Brier/ECE, correct-versus-incorrect confidence counts |
| Explainability | Signed permutation bars with repetition SD; exact additive waterfall; PDP plus recorded ICE; original/hypothetical outputs; subgroup metrics/support; CART decision path, forest aggregates, kNN votes and aggregate distances, baseline outputs |
| Iterative training | Actual training objective recorded after each logistic or softmax update; other algorithms have no epoch trace |

The existing seven F12 model families remain supported: baseline, ridge, logistic, kNN, softmax, CART, and random forest. The controls show task-compatible evaluation views. Local waterfall units are regression target units, binary log-odds, or a predicted-class softmax logit. They are never additive probability contributions. Forest class votes are hard leaf decisions and need not equal the forest's mean leaf probability vector.

## Scientific contracts

`modelChartSpec.js` is a dedicated model-report entry point into ChartSpec v2. It does not manufacture datasets to call the F18 dataset API. It checks candidate/model/task/features/class ordering, exhaustive disjoint split membership, report identity, exact scored-row order and targets, finite normalized probabilities, recorded residual signs, and consistency of reported F12 metrics/confusion/per-class results. The consistency check uses recorded outputs; it never calls the prediction or fitting engine.

Public model provenance includes candidate, model, report, split-membership, pipeline, and source-context SHA-256 digests. Source-context identity hashes feature schema, membership, and pipeline lineage rather than reading sealed test targets. Charts cannot request final-test scoring. A final-test chart accepts only the already-created F12 final report with matching candidate and access timestamp. Explanations remain validation-only. Training curves are labeled training-only and bind to their original candidate and trace scope.

Changing candidate unmounts the prior session, cancels explanation workers, drops linked records, and invalidates pending chart results. F19 sessions are temporary: no per-row predictions, explanation outputs, or chart configurations are added to F14/IndexedDB. Existing F14 receipts and inference-artifact rules remain unchanged.

## Numerical definitions

- Residual = actual − predicted. Eight equal-width residual/target bins use left-inclusive, right-exclusive boundaries; the last includes the maximum. A constant population uses one bin. Empty target bins have unavailable MAE.
- Confusion matrix count scaling uses the measured maximum, rather than the F18 correlation range. Row fractions divide by true class support. Undefined per-class metrics preserve F12 null values.
- ROC and PR derive only from recorded probabilities in the fitted class order. All equal scores enter together. ROC AUC uses trapezoids and requires both positive and negative outcomes. PR requires positives; its summary is non-interpolated average precision, not trapezoidal PR area. Precision before any predicted positives is unavailable. Missing probabilities are not inferred from labels.
- Calibration uses ten equal-width [left, right) bins; the final bin includes 1. Empty bins remain unavailable. Brier is mean squared one-vs-rest probability error. ECE is the sum of support/N times the absolute difference between bin mean probability and observed positive fraction. Class prevalence and support are retained.
- Confidence means maximum recorded class probability. Correct/incorrect distributions use ten bins; these scores carry no real-world uncertainty guarantee.
- Permutation variability is population SD over the existing repetitions, drawn as ±SD and explicitly not a confidence interval. Negative importance is retained.
- PDP and ICE preserve F13's training-derived sweep and validation background. Subgroups preserve its training median, minimum support, and bounded validation sample. What-if uses the completed frozen-pipeline hypothetical calculation, without causal interpretation.
- Iterative traces contain completed epoch and training cross-entropy plus L2 objective. Trace capture reads fitted weights after each existing update and never changes those updates. No validation/test losses or fabricated traces are added.

## Shared chart experience and privacy

All applicable charts retain Chart, Data, Python, JavaScript, and Methods views, exact CSV/JSON exports, and SVG/PNG exports with SVG or Canvas rendering. Selected plotted error records can open a bounded session-only prediction table. Internal source IDs are excluded from portable charts. Neighbor identities, individual neighbor distances, training vectors, and model weights are never added to chart exports.

Aggregate chart evidence is portable by default. Observation-level coordinates, local contributions, ICE, paths/votes, and hypothetical outputs require explicit consent. Their default JSON contains metadata only, including no row-level statistics or rendering coordinates. Python and JavaScript reproduce saved plotted evidence, not training or analysis. JavaScript restores trusted custom waterfall/SD rendering primitives after loading JSON; user labels remain data.

Chart families load on demand; hidden F19 surfaces unmount their renderers. Theme handling, responsive controls, separate keyboard-accessible data tables, resizing, renderer disposal, and image downloads use the shared PRISM implementation. Model canvases retain a 480 px minimum width inside a focusable horizontal scroll region, so nested mobile panels do not compress axes into unreadable slivers. Waterfalls reserve additional space for category labels. The 2,000-source-row budget remains.

## Verification commands

Run `npm test`, `npm run lint`, `npm run build:client`, and `npm run test:integration`. Browser coverage is in `prism-model-evaluation-f19.spec.mjs` and `prism-explainability-f19.spec.mjs`, including desktop/mobile charts, explicit final-test access, candidate switching, worker cancellation/restart, exports, and bounded rendering benchmarks. The four F19 numerical suites cover reference probability fixtures, exact contributions, provenance, privacy, and unchanged model parameters/predictions when traces are enabled.

`node scripts/export-python-chart-fixtures.mjs` writes 29 F18/F19 reproduction fixtures. With pandas, NumPy, Matplotlib, and Seaborn installed, `python scripts/verify-python-charts.py` executes the generated programs and renders each plot using Agg. CI installs Python 3.12 and pinned plotting dependencies and runs both commands. This Windows workspace has no installed Python runtime, so local Python execution is not claimed.

F20 cross-validation/search/comparison dashboards, SHAP, causal/fairness guarantees, cloud training, and durable prediction-session restoration remain outside this implementation. Implementation status is distinct from deployment status; no PR, merge, or deployment is implied by these notes.

## Recorded verification — 2026-10-21

All 233 unit tests, lint, production build, and real MongoDB integration passed. The complete browser suites passed 180 tests in database mode and 180 in memory mode, without failures, skips, or retries. After the final mobile width/label-spacing adjustment, all 14 F19 desktop/mobile browser cases passed again, including keyboard scrolling, image exports, downloaded JavaScript execution, cancellation/restart, candidate switching, and protected final-test access. Mobile chart viewports and desktop charts were visually inspected; narrow viewports intentionally pan across the full-width canvas.

The final F19 benchmark used a 2,000-row source dataset and rendered its recorded validation predictions. Timings cover chart initialization, not model fitting, preprocessing, report computation, or a full upload workflow. These local measurements are not device-independent performance guarantees.

| Final F19 rerun | SVG initialization | Canvas initialization |
| --- | ---: | ---: |
| Desktop | 710.5 ms | 110.2 ms |
| Mobile | 316.4 ms | 69.6 ms |

Full reports remain in `.artifacts/e2e-database/results.json` and `.artifacts/e2e-memory/results.json`, with the combined baseline in `.artifacts/verification-summary.json`. The final F19 rerun, screenshots, and benchmark attachments are separately preserved in `.artifacts/f19-final`. Generated Python fixtures are in `.artifacts/python-charts`; Python execution is configured in CI but was not run locally because the runtime is unavailable.
