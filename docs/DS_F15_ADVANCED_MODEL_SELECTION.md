# DS-F15 — Advanced ML & Leakage-Safe Model Selection

## Scope shipped in this PR

F15 adds multiclass softmax regression, N-dimensional classification/regression CART, bounded seeded random forests, and a **browser-worker-powered fold-safe model search**. It plugs into F12 for the original training-only refit and fixed validation measurement, F13 for model-aware explanations, and F14 for archived summary-only model-selection evidence.

This is an integrated first F15 release. It does not claim production-scale hyperparameter optimization, statistical confidence intervals, gradient boosting, nested CV or cloud training.

## User workflow

1. Dataset Explorer → F11 Advanced Pipeline Studio → F12 Professional ML Workbench.
2. Expand **F15 — Advanced Model Selection**.
3. Choose a compatible algorithm, 3 or 5 folds, and a task-appropriate metric.
4. Run a bounded preset search. Worker progress and a table of fold scores, mean and **sample SD** appear, with unavailable configurations labeled honestly.
5. Select a completed configuration and click **Train selected configuration on original training split**. The model is refitted on the original F11 training partition, and measured separately on the original fixed validation partition.
6. Inspect the model and explanations in F12/F13. Only when satisfied explicitly unlock the original held-out test once.
7. Save the candidate in F14; its receipt stores a versioned F15 selection summary and fold membership digest, never original fold row IDs or source data.

## Algorithms

| Algorithm | Classification | Regression | F13 local view | F14 persistence |
|---|---|---|---|---|
| Multiclass softmax | Binary and multiclass | No | Exact predicted-class **logit** contributions | Summary receipt |
| N-dimensional CART | Binary and multiclass | Yes | Exact decision path and leaf support | Summary receipt |
| Seeded random forest | Binary and multiclass | Yes | Per-tree class votes or aggregate regression value | Summary receipt |
| Existing baseline, logistic, ridge and kNN | Existing task limits | Existing task limits | Existing F13 methods | Existing F14 policy |

Softmax normalizes exponentials with the maximum logit subtracted for numerical stability. L2 regularization excludes intercepts. CART uses Gini impurity for classification and squared-error reduction for regression with bounded depth/leaves and deterministic ties. Forests use seeded bootstrap sampling and per-node feature subsampling. Tree and forest fitted objects consist of bounded node aggregates; raw source IDs/vectors are not embedded in them.

**Do not interpret a softmax feature contribution as an additive class probability**: contributions add to one class logit, and probabilities depend on the logits of every class.

## Correct cross-validation protocol

- Start exclusively with the ORIGINAL F11 `membership.train` source row IDs, never its validation or held-out test rows.
- Stratify inner folds by class for classification when every class has at least k training records. Regression uses seeded randomized folds without stratifying continuous targets.
- Build a restricted source dataset from only the original training rows, and explicitly supply each fold's train/validation assignment to F11.
- Re-run **all enabled F11 transformation stages from source rows** on every inner fold, fitting means, medians, scaling, categorical vocabulary and engineered features from that fold's training rows only. No cross-fold/global prepared feature matrix is reused.
- Train the selected algorithm only on that fold's training matrix; score only against the inner validation rows.
- Calculate mean and sample standard deviation of completed defined fold scores. A configuration with unavailable fold metrics cannot win.
- Use only inner CV to select a configuration. On user action refit selected parameters on the already F11 training-fitted *original* prepared matrix; evaluate the fixed original validation membership separately.
- **Never consult original held-out test labels during training, search, ranking, or explanations.** F12's existing explicit final-test gate and F14 audit remain intact.

This is not grouped/time-series CV. Fold-wise imputation/one-hot behavior can explicitly fail for rare/unknown categories rather than inventing data. Fold SD represents variation across folds, not a confidence interval or a formal significance test.

## Resources

- Existing CSV limits: 2 MiB, 2,000 rows, 20 source columns; F11 output up to 20 numeric columns.
- Inner CV: 3 or 5 folds, at most 12 configurations and **60 model fits** per search. Preset grids currently hold 1–3 configurations per algorithm.
- Forest: 3–30 trees per fit, CART depth 1–7, minimum leaf 2–30. Softmax epochs 20–400 and bounded L2.
- Only one search worker per F15 panel. Termination cancels it. The browser receives fold metrics and provenance digest, not source rows.
- A cancelled search is displayed as cancelled and **cannot be promoted**. Automatic resume of partial worker jobs is deferred.
- Older F12 limits of up to eight candidates per investigation and final-test lock remain unchanged.
- All computation is local-first; no new server API or Python/cloud dependency is introduced.

## F13/F14 interaction

F13 global permutation importance, PDP, what-if and subgroup analyses already work through F12's shared prediction adapter. New local evidence uses softmax class logit contributions, CART decisions, or forest tree votes; no claim of SHAP or causality.

F14 v1 receipts remain readable. F15 adds an **optional** `selectionEvidence` field containing algorithm/task/metric, fold count/seed, fold membership digest, configuration trials, fold scores and selected result. Stored data is allowlisted: there are no fold row IDs or raw predictions. Research reports and the archive inspector display these results. Existing F14 artifact-validator restrictions remain: softmax, CART and forest cannot silently be persisted for inference replay, regardless of their model type.

## Modules

- `client/src/ml/modelWorkbench/softmax.js`: stable class softmax training/prediction
- `client/src/ml/modelWorkbench/cart.js`: N-dimensional bounded regression/classification trees
- `client/src/ml/modelWorkbench/randomForest.js`: bootstrap and tree-vote/mean aggregation
- `client/src/ml/modelSelection/folds.js`: deterministic inner fold identities
- `client/src/ml/modelSelection/foldPipeline.js`: leakage-safe fold-specific F11 refitting
- `client/src/ml/modelSelection/searchManifest.js`: task-aware bounded preset configuration grids
- `client/src/ml/modelSelection/crossValidation.js`: scoped fold fits, metrics and deterministic evidence
- `client/src/ml/modelSelection/searchWorker.js`: cancellable local search job
- `client/src/ml/modelSelection/selectionEvidence.js`: validated F14-compatible selection receipt summary
- `client/src/components/workspace/modeling/ModelSelectionStudio.jsx`: search UI, fold leaderboard and selection

## Verification

- `tests/model-selection-f15.test.mjs` covers softmax numerical probabilities, CART/forest classification/regression, deterministic models, logit/path/vote explanations, class-stratified folds, fold-only fitted imputation, original holdout poisoning, reproducible CV, budgets, cancellation, F14 evidence integration and historical-model compatibility.
- `tests/e2e/model-selection-f15.spec.mjs` covers browser worker search and promotion, F13 and F14 integration, multiclass softmax and regression CV on desktop/mobile.
- Existing tests remain unchanged except extending an explicit old-model registry list to include the newly delivered families.
- Release gate: `npm run check`, `npm run test:e2e:memory`, and `npm run baseline:summary` green before review.

## Deferred

- User-authored arbitrary search grids, Bayesian search, nested CV, confidence intervals, arbitrary grouped/time-series folds.
- Source dataset reattachment/retraining after browser refresh.
- Opt-in safe artifact replay for the new model types until their validators are separately audited.
- Scaled forest training, resumable searches and worker-level performance benchmarks on low-end mobile hardware.
- Full N-dimensional neural architectures and boosted trees.
