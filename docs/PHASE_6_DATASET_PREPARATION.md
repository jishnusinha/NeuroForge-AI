# Phase 6 — Dataset Preparation, Feature Engineering, and Evaluation Protocols

> Review correction: this historical phase note does not certify roadmap completion. See [post-review remediation](REVIEW_REMEDIATION.md) for integrated behavior, verification, and remaining deployment gates.

## Status: Implementation reviewed; production gates remain

### Overview
Phase 6 provides a scientifically sound tabular dataset preparation and evaluation protocol engine for NeuroForge. It establishes anti-leakage preprocessing pipelines, stratified multi-way evaluation splits, and secure bounded CSV ingestion.

---

### Key Capabilities Delivered

1. **Bounded & Secure CSV Ingestion (`client/src/ml/datasetImport.js`)**
   - **Formula Injection Mitigation**: Rejects files beginning with spreadsheet execution characters (`=`, `+`, `-`, `@`) to protect users from CSV/DDE injection attacks.
   - **Resource Guards**: Configurable row caps (default max 2000 rows) and column caps (default max 20 columns) prevent memory starvation.
   - **Automated Profiling**: Computes per-column data types (`numeric` vs `categorical`), min, max, mean, and missing value counts.
   - **Feature Minimums**: Enforces a minimum count of usable numeric features for neural network and tabular model compatibility.

2. **Strict Anti-Leakage Preprocessing Pipeline (`client/src/ml/preprocessingPipeline.js`)**
   - **Training-Only Fitting**: `fit()` calculates sample means, standard deviations, and min/max ranges exclusively from training records.
   - **Immutable Parameter Application**: `transform()` applies the fitted parameters to validation, test, and inference inputs without mutating baseline statistics.
   - **Transform Steps**: Supports zero-leak `standardize` (Z-score), `minmax` ([0, 1] normalization), mean `impute`, and derived `polynomial` features (squares $x_i^2$ and interaction terms $x_1 \times x_2$).
   - **Deterministic Serialization**: Full export and hydration via `toJSON()` and `PreprocessingPipeline.fromJSON()`, ensuring saved models reproduce identical predictions during subsequent sessions.

3. **Stratified Multi-Way Evaluation Split (`client/src/ml/evaluationProtocol.js`)**
   - **Deterministic Seeded PRNG**: Uses Mulberry32 algorithm to guarantee identical split allocations given a seed.
   - **Stratified Partitioning**: Preserves class proportions across 3 distinct sets: `train`, `validation`, and `test`.
   - **Test Access Auditing**: Tracks all test-set evaluation inquiries via `recordTestAccess()`, preventing unrecorded data snooping and maintaining provenance.

---

### Verification & Test Evidence
- **Test File**: `tests/evaluation_preprocessing.test.mjs`
- **Results**:
  - `CSV Importer safely parses tabular data, computes profiles, and rejects formula injection`: Passed
  - `Preprocessing pipeline guarantees strict anti-leakage (fitted only on training data)`: Passed (extreme test outliers do not mutate fitted mean/variance)
  - `Preprocessing pipeline serializes and deserializes accurately for inference`: Passed (100% numerical match)
  - `Stratified split preserves exact class distribution across partitions`: Passed (60%/40% balance preserved across splits)
  - `Test set access is audited and recorded in evaluation protocol`: Passed
