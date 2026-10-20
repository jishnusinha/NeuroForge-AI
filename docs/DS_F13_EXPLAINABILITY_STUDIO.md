# DS-F13 — Model Explainability & Diagnostics Studio

## Release scope

This implementation connects **real F12 fitted candidates** to validation-only explainability, grounded in the frozen F11 preprocessing artifact. It extends the Dataset Explorer's F12 modeling panel; it does not replace the historical 2D Error Explorer / Reliability Lab.

User journey:

1. Dataset Explorer → Advanced Pipeline Studio (F11) → F12 Professional ML Workbench.
2. Train one F12 candidate on actual prepared features.
3. Expand **F13 — Explainability & Diagnostics Studio** below the candidate validation report.
4. Explore model-aware evidence, then export a privacy-conscious JSON summary.

### Implemented analysis methods

| Tool | Implementation | Supported models | Population |
| --- | --- | --- | --- |
| Repeated global permutation importance | Seeded validation feature shuffles, 3 repetitions, baseline score and standard deviation | Baseline, binary logistic, ridge, binary/multiclass kNN | Validation only |
| Local prediction explanation | Exact standardized-feature contributions that sum to regression output or logistic **log-odds** | Ridge, logistic | Selected validation row |
| Baseline explanation | Training-only mean or class priors; feature contributions are not invented | Baseline | Selected validation row |
| Neighbor voting | Sorted nearest distance and class-vote counts; no training record IDs or feature vectors returned | kNN | Selected validation row |
| Partial dependence and ICE | Frozen-model predictions on a bounded grid derived from **training feature ranges** and bounded validation background | All F12 models | Validation background |
| Source-space what-if | Edit one source input inside training-observed numeric range/category; replay F11 fitted artifact without refitting | All F12 models | Selected validation row |
| Subgroup diagnostics | Train-median split of a prepared feature; exact task-aware validation scores and minimum support guard | All F12 models | Validation only |
| Reproducibility report | Model and pipeline SHA-256 digests, methods, settings, aggregate metrics, limitations | All F12 models | Summary only |

### Scientific and privacy boundaries

- F13 never calls the F12 final-test evaluation. Interactive diagnostics accept only matrix rows with **validation** membership.
- F13 does **not** claim causal feature effects, fairness judgments, SHAP, or counterfactual guarantees.
- Logistic model contributions reconstruct **log-odds**, not probability. Ridge contributions reconstruct target prediction. Baselines do not fabricate attributions.
- A permutation importance near zero may reflect correlated features, not irrelevance. Negative importance remains possible and is shown.
- PDP/ICE features are perturbed independently; co-varying or one-hot dependencies can be broken. Users see this limitation.
- Raw-input what-if replay applies the **existing frozen F11 artifact** and does not update training-fitted statistics. One-hot categories must come from training observations; numeric values are kept inside observed training bounds.
- kNN explanations include class vote counts and distances, not training example identifiers/vectors.
- The default JSON export omits **raw observations, individual row IDs, neighbor identities, training feature vectors, fitted model coefficients and local source feature values**. Hashing the fitted artifact does not put its contents in the exported receipt.
- No new server endpoint, cloud upload, or Python runtime is required.

### Resource constraints

- Imported data limits remain 2 MiB, 2,000 rows and 20 source columns.
- F11 output feature limit remains 20.
- Permutation importance analyzes the first **up to 12 prepared features** on a deterministic sample of **up to 80 validation rows**, with **3 shuffles per feature**. The UI explicitly labels subsampling and unexamined features.
- Permutation runs in a dedicated ES-module Web Worker. Cancelling terminates that worker; changing candidate unmounts the job and terminates it.
- PDP uses at most 20 grid values and 24 validation background rows (default 11 grid points, six ICE curves).
- Subgroup diagnostics use up to 200 validation rows and require at least five observations in a group for a measured score.
- Selected local/what-if rows are bounded to the first 80 validation entries for inspection. Training and test examples cannot be selected.
- Explanation results are in browser state and reset on candidate change/page reload. No server-side persistence, dashboard synchronization, arbitrary shell execution or user data transmission is introduced.

### New code

| File | Responsibility |
| --- | --- |
| `client/src/ml/modelWorkbench/explainabilityContracts.js` | Strict model/schema validation, validation-only sampling, supported metrics |
| `client/src/ml/modelWorkbench/permutationImportance.js` | Seeded repeated global importance and uncertainty |
| `client/src/ml/modelWorkbench/localExplanations.js` | Exact linear/logistic contributions and bounded kNN vote evidence |
| `client/src/ml/modelWorkbench/partialDependence.js` | Model-derived PDP and individual ICE curves |
| `client/src/ml/modelWorkbench/whatIfDiagnostics.js` | Frozen-source preprocessing replay under validated user edits |
| `client/src/ml/modelWorkbench/subgroupDiagnostics.js` | Numeric validation performance slices using train-defined boundary |
| `client/src/ml/modelWorkbench/explanationEvidence.js` | Summary-only reproducible explanation receipt |
| `client/src/ml/modelWorkbench/explanationWorker.js` | Cancellable dedicated worker for permutation analysis |
| `client/src/components/workspace/modeling/ExplainabilityStudio.jsx` | Accessible visual interface and report export |
| `client/src/components/workspace/modeling/ModelWorkbench.jsx` | F12 candidate-scoped F13 integration |

### Verification

- `tests/explainability-f13.test.mjs` covers deterministic permutation signal ranking, baseline zero importance, train/test separation, exact local reconstruction, kNN privacy boundaries, PDP numerical parity, frozen preprocessing what-if and input guards, subgroup measurements, and export redaction.
- `tests/e2e/explainability-f13.spec.mjs` tests browser worker/UI, local explanation, what-if, PDP, subgroup evidence, and JSON export on binary, regression, and multiclass fixtures in desktop/mobile.
- CI must pass `npm run check`, `npm run test:e2e:memory`, and the repository's verification summary.

### Deferred enhancements (not represented as implemented)

- Model-specific SHAP or approximate Shapley analyses (requires substantial independent numerical verification).
- Robust feature-group / conditional permutation algorithms for correlated or one-hot columns.
- Grid/search counterfactuals with plausibility constraints and optimization.
- Expanded calibration, residual distribution plots, error auditing by original demographic attributes, and statistical uncertainty intervals.
- Shared persisted explanation studies, N-dimensional Arena comparison and notebook integration.

The initial DS-F13 is an honest, bounded explanation laboratory focused on **verified model computations, reproducible validation scope and transparent limitations**.
