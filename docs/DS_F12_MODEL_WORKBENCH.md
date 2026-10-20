# DS-F12 — Generalized Machine Learning Workbench (foundation release)

This release delivers an **interactive, browser-local, N-dimensional supervised modeling slice** built on the merged F10/F11 work. It is an incremental F12 implementation, not a claim that every proposed F12 phase (ensemble models, Arena integration, etc.) is complete.

## Open the workbench

1. Navigate to **Dataset Explorer** (`/app/datasets`), import a CSV or use the sample dataset.
2. Expand **Advanced Pipeline Studio (F11)**.
3. Select **F12 learning task**: classification or regression. Choose target, input features, and compatible preprocessing nodes. Regression requires a fully observed numeric target.
4. Confirm that F11 produces a valid prepared matrix. Expand **F12 — Professional ML Workbench**.
5. Choose a model, train it, compare **validation** scores, inspect per-row evidence.
6. Choose a final candidate and explicitly unlock the sealed test split once. Export an evidence summary when desired.

The previous two-input Playground and Studio remain unchanged. F11 still blocks launches incompatible with their historical 2D binary task.

## Delivered in this pull request

### Task-aware F11 handoff and universal feature matrix
- The F11 recipe schema stays at version 1, with the new **optional** `taskType` field; older saved recipes default to classification.
- Classification uses the existing seeded, class-stratified F11 split; regression uses a separate seeded random split that **never groups by continuous target values**.
- The model adapter validates ordered feature schema, up to 20 finite numeric features, unique source row IDs, complete non-overlapping train/validation/test membership, and task-appropriate target values.
- A multiclass class vocabulary is derived deterministically from **training** labels. Classes absent from training fail explicitly.
- The whole prepared numerical feature vector enters modeling, including one-hot outputs and engineered features. No silent x/y projection.

### Deterministic browser-local model registry
- **Training-only baseline**: majority-class classifier or mean-target regressor.
- **Binary logistic regression**: arbitrary feature dimension; training-fitted standardization and bounded L2-regularized gradient descent.
- **Ridge regression**: arbitrary feature dimension; training-fitted standardization and bounded L2-regularized least squares with pivoted linear algebra.
- **kNN classification**: arbitrary feature dimension; deterministic training-fitted scaling, bounded k and stable tie ordering. Supports binary and multiclass targets.
- `predictWorkbenchModel()` replays any fitted model in JSON format. kNN fitted artifacts necessarily contain training-feature vectors, so this UI deliberately **does not offer automatic trained-model export**.

### Scientific evidence and UI
- Candidate runs are evaluated only on the fixed **validation** membership, with an eight-candidate limit.
- Task-aware metrics:
  - Binary: accuracy, positive-class precision/recall/F1, macro/weighted F1 and full confusion counts.
  - Multiclass: accuracy, per-class support, macro/weighted F1 and N×N confusion counts.
  - Regression: MAE, MSE, RMSE, R² (unavailable for constant target).
- Undefined denominators are reported as unavailable, not silently turned into successful scores.
- A clear final-test action scores only the selected candidate once and freezes further training/selection within the current browser session. The timestamp of access is captured.
- Per-record validation/final-test predictions and methods are visible. JSON evidence export includes run metadata, pipeline checksum and aggregate metrics **without raw observations or fitted weights**.
- All operations remain local to the browser. Default static deployment does not need a new backend.

## Source code

| Component | Responsibility |
| --- | --- |
| `client/src/ml/modelWorkbench/splits.js` | Seeded task-aware regression split |
| `client/src/ml/modelWorkbench/featureMatrix.js` | Full F11-to-F12 prepared matrix with immutable lineage |
| `client/src/ml/modelWorkbench/models.js` | Model registry, train-only fits and deterministic prediction |
| `client/src/ml/modelWorkbench/metrics.js` | Typed validation/test metrics and per-row evidence |
| `client/src/components/workspace/modeling/ModelWorkbench.jsx` | Model training/selection/evidence UI |
| `client/src/ml/pipelineGraph.js` | Optional task type in compatible F11 recipe v1 |
| `client/src/ml/pipelineExecutor.js` | Task-specific F11 split selection; legacy lab compatibility preserved |
| `client/src/components/workspace/pipeline/PipelineStudio.jsx` | F12 task selector and editor integration |

## Safeguards and limits

Existing importer limits remain: 2 MiB CSV, 2,000 rows, 20 input columns and 20 prepared numeric outputs. The F11 graph remains capped at 16 nodes, with eight categories per one-hot input.

All learned parameters are fitted on training records. The validation split is available for candidate selection; the held-out test split remains sealed until explicit final evaluation. Continuous regression targets never undergo class stratification. The current UI has no automated hyperparameter sweep across test data.

The final-test lock is a **session-scoped UX safeguard**, not a cryptographically enforceable restriction. Opening a new session resets it; reports retain an access timestamp only if exported.

Because F12 models live in React state, refreshing the page clears the candidates. The evidence JSON intentionally excludes fitted coefficients and training vectors, and it is **not** a deployable model artifact.

## Verification

- `tests/model-workbench-f12.test.mjs`: deterministic regression split independent of y, multifeature adapter, N-feature ridge accuracy, binary logistic, multiclass kNN, train/heldout separation, edge-case metrics, artifact replay, invalid inputs and task-specific registry.
- `tests/e2e/model-workbench-f12.spec.mjs`: sample binary training and final-test gate, realistic continuous regression with three features, multiclass kNN and confusion matrix on desktop/mobile.
- CI uses existing `npm run check`, `npm run test:e2e:memory`, and verification summary.

## Deferred F12 milestones

- Generalized CART/random forests, softmax logistic regression and N-dimensional neural networks.
- Long-running training jobs in Web Workers with cooperative cancellation.
- Persisted, versioned fitted model artifacts and N-dimensional Arena integration.
- Cross-validation with fold-specific preprocessing refits, confidence intervals and advanced calibration/ROC diagnostics.
- Production-oriented larger datasets and optional Python job backend.

These must be shipped as follow-up PRs rather than implied by this foundation release.
