# Phase 7 — Error Explorer and Linked Sample Analysis

> Review correction: this historical phase note does not certify roadmap completion. See [post-review remediation](REVIEW_REMEDIATION.md) for integrated behavior, verification, and remaining deployment gates.

## Status: Implementation reviewed; production gates remain

### Overview
Phase 7 introduces an interactive Error Explorer that turns machine learning failures and residual errors into an inspectable, transparent, and actionable product experience.

---

### Key Capabilities Delivered

1. **Per-Sample Failure Diagnostics (`client/src/ml/errorExplorer.js`)**
   - **Sample-Level Tracking**: Evaluates each sample against current decision thresholds without mutating original experiment records.
   - **Classification Partitioning**: Categorizes every sample into True Positives (TP), False Positives (FP), True Negatives (TN), and False Negatives (FN).
   - **Confidently Wrong Detection**: Flags samples where the model predicted with high confidence (e.g. $|P - Y| \ge 0.6$) but was wrong.
   - **Borderline Identification**: Flags samples whose predicted probability falls tightly within the decision boundary margin ($\le 0.10$).
   - **Statistical Cautions**: Automatically flags small sample sizes ($N < 20$) with cautionary badges to avoid misrepresenting small slices as conclusive proof.

2. **Interactive UI Studio Component (`client/src/components/workspace/ErrorExplorer.jsx`)**
   - **Continuous Threshold Slider ($\theta \in [0.01, 0.99]$)**: Dynamically adjusts decision thresholds, displaying real-time updates to precision, recall, and F1.
   - **Selectable 2x2 Confusion Matrix**: Direct click filtering isolates specific error cohorts (e.g. all False Positives) in the sample table.
   - **Failure Annotations**: Researchers can attach timestamped, author-attributed diagnostic observations directly to specific samples.

3. **Comparative Run Error Diffing (`compareRunErrors`)**
   - Evaluates two candidate runs evaluated on identical test/validation sets.
   - Partitions samples into:
     - **Corrected Mistakes**: Samples previously misclassified by baseline, now predicted correctly.
     - **Regressions (Newly Introduced Errors)**: Samples previously correct, now broken.
     - **Persistent Errors**: Difficult samples failed by both models.
     - **Shared Correct**: Samples solved by both models.

---

### Verification & Test Evidence
- **Test File**: `tests/error_explorer.test.mjs`
- **Results**:
  - `Evaluates sample predictions, confusion matrix cells, and confident errors`: Passed
  - `Threshold tuning updates predictions dynamically without mutating base samples`: Passed
  - `Slice metrics analysis isolates subsets and cautions on small cohorts`: Passed
  - `Compares two runs to detect corrected mistakes and newly introduced regressions`: Passed
  - `Creates immutable observation annotations tied to specific runs and samples`: Passed
