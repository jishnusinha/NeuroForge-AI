# DS-F14 — Reproducible Experiment Registry & Model Lifecycle

## What is shipped

F14 turns F12/F13 browser sessions into durable, owner-scoped **research receipts**. It adds:
- explicit Save/Update F14 research run in the F12 Model Workbench,
- searchable local F14 archive under **My Experiments**,
- run renaming, tags, notes and revision-aware deletion,
- strict comparison by measured **validation** population and metric meaning,
- durable final-test access audit for previously saved runs, and ability to save an unsaved final-test receipt,
- F13 summary explanation attachment to the exact saved candidate,
- opt-in fitted artifact integrity validation and prepared-vector inference replay for baseline, logistic and ridge models,
- Markdown research reports based on recorded F12/F13 evidence.

The existing legacy Playground/Neural Studio runs, Arena, backend and Research Notebook remain available. F14 is a **separate, versioned run contract**; it does not quietly migrate or overwrite legacy records.

## User journey

1. Open Dataset Explorer, import a CSV, prepare features in F11 and train a model in F12.
2. Open **F14 — Preserve this research run**, enter a title, and click **Save F14 research run**. The default saves aggregate metrics, SHA-256 fingerprints, configuration and counts only.
3. If using a baseline, logistic or ridge model, optionally check **Opt in to saving fitted model parameters**. Training-fitted means and weights can disclose information about training data; no model is stored without this choice. kNN cannot be saved as a fitted artifact because its current model holds training vectors.
4. F13 can attach its summary-only explanation receipt with **Attach F13 evidence to saved F14 run**. The receipt is bound to the saved model and pipeline digests.
5. If the run was already saved, explicitly opening the protected final test automatically attempts to update that run's local audit record. If this save fails, the UI reports that failure; it does not claim durable audit success. If a run is unsaved, save it after the final test to record the access.
6. Open **My Experiments → F14 Reproducible Run Registry** to search, filter, inspect validation metrics, inspect F13 summaries, compare runs and export a Markdown report.
7. If a fitted artifact was explicitly saved, verify its SHA-256 checksum and enter ordered **prepared numerical feature values** to replay a model prediction. This is not a source-space preprocessing replay.

## Schema and provenance

`client/src/ml/modelRegistry/runContracts.js` establishes `kind:'neuroforge-f14-run'`, `schemaVersion:1`.

Saved receipts contain:
- ordered prepared numeric feature names, task type, target column, deterministic class mapping,
- SHA-256 source-dataset digest, exact split-member digest, fitted-pipeline digest, ordered feature-schema digest and model digest,
- model algorithm, configuration and opt-in artifact storage mode,
- recomputed recorded validation metrics and sample count,
- at most one final-test access audit event per saved candidate,
- up to eight attached aggregate F13 explanation summaries,
- user title, tags, notes, revision and timestamps.

**No source rows, row IDs, validation/test prediction records, source dataset, fitted F11 pipeline parameters or kNN training examples are stored in receipts.** The digest of the source is calculated in memory without storing a copy of the source in IndexedDB.

The original F11/F12 numeric feature list and membership are not inferred from a human-readable dataset name. Comparability requires matching source, split, task, target definition and metric version; differing preprocessing may be compared, with a warning, when the evaluation population actually matches.

## Local persistence and conflict handling

`localRepository.js` adds atomic versioned snapshot operations using the existing IndexedDB `snapshots` store, plus prefix-scoped listing. Writes enforce owner isolation, optimistic compare-and-swap revisions and a maximum of **30 F14 receipts per account**. The baseline storage soft quota remains 10 MiB. There is no indexed database migration, and older snapshot APIs are not modified.

The F14 repository is at `client/src/services/modelRegistryRepository.js`. Storage is explicit: no automatic model or source upload, and a failed IndexedDB write is surfaced to the user. The archive displays records stored for the current browser account, not remotely synchronized or tamper-proof history.

## Reproducibility levels and privacy

1. **Evidence receipt (default):** browse or compare measured findings after reload. No model inference.
2. **Opt-in inference artifact:** restore a validated baseline, logistic or ridge fitted model and predict from manually supplied *prepared feature vectors* in the original column order. SHA-256 verifies artifact consistency with the saved receipt; it is not a signature against adversarial tampering.
3. **Full retraining reproduction:** **not shipped**. The app does not persist the original source CSV, F11 fitted pipeline or an executable environment. Users must not interpret a saved receipt as full retraining parity.

Fitted model parameters reveal information about training data, which is why only an explicit opt-in stores them. kNN fitted artifacts contain training-feature vectors and are **always receipt-only**. F13 evidence exports remain summary-only and are bound to their original candidate, pipeline, feature order and validation scope.

## Model comparison rules

- Only recorded **validation** metrics can rank models. Never use final-test metrics for candidate selection.
- A comparison is **comparable** only if source digest, exact partition membership digest, task, target and class definitions, and metric definition match, and both scores exist.
- Different source, target or partitions are **contextual** (side-by-side values without a ranked winner).
- Missing/undefined metric values are **unavailable**, not filled in with zero.
- Different F11 preprocessing/feature sets can still be meaningfully compared on the same held-out validation population. This is disclosed rather than silently ignored.
- Higher is better for accuracy/F1/R²; lower is better for MAE/RMSE.
- No batch/model grid search automatically accesses final-test records.

## Code map

| File | Role |
|---|---|
| `client/src/ml/modelRegistry/runContracts.js` | Versioned receipt, provenance hashes and recorded evidence |
| `modelRegistry/comparability.js` | Validation-only task-aware comparison |
| `modelRegistry/artifactValidator.js` | Opt-in model checksum, structure checks and inference replay |
| `modelRegistry/runLifecycle.js` | Non-destructive metadata updates, F13 evidence attachment |
| `modelRegistry/reports.js` | Evidence-only Markdown report builder |
| `client/src/services/modelRegistryRepository.js` | Owner-scoped F14 CRUD wrapper |
| `client/src/services/localRepository.js` | Transactional versioned IndexedDB persistence |
| `components/workspace/registry/F14RunRegistry.jsx` | Search, inspect, compare, edit, replay and report |
| `components/workspace/modeling/ModelWorkbench.jsx` | F12 Save Run action and recorded test-access update |
| `components/workspace/modeling/ExplainabilityStudio.jsx` | Attach F13 summary evidence |
| `client/src/pages/ExperimentsPage.jsx` | F14 archive alongside existing experiment views |

## Verification

- `tests/model-registry-f14.test.mjs`: source/model fingerprints, privacy boundaries, comparison rules, replay checksums, final-test access records, annotation/attachment validation, account isolation and optimistic concurrency under memory storage.
- `tests/e2e/model-registry-f14.spec.mjs`: regression artifact save → F13 attachment → final-test archive → browser refresh → inference replay → note edits → Markdown export; compatible binary model comparison; kNN privacy-only storage.
- CI release gates: `npm run check`, `npm run test:e2e:memory`, verification summary and no previous-lab regressions.

## Limitations and next phases

- A receipt is durable only in its current browser account's IndexedDB storage. Clearing browser data removes it. There is no automatic cloud sync.
- Local audit history is a UX safeguard, not cryptographic access control. A new experiment can be created and local data can be altered.
- Raw datasets are **not** retained, so reattaching a dataset to rerun F11/F12 from its original rows remains future work.
- Saved F13 studies are summary snapshots rather than re-runnable local explanation sessions.
- No Python endpoint, general N-dimensional Arena sweeps, MLflow tracking server, collaborative permissions or production deployment is introduced by this release.
