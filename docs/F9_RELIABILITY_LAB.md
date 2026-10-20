# F9 — Reliability and Synthetic Shift Laboratory

The existing completed, non-stale Logistic Regression and KNN Playground classifications now expose a model-backed reliability investigation below the original Error Explorer.

### Measured results
The validation partition's exact binary labels and **real fitted-model predicted probabilities** are used to calculate:
- Brier score = mean squared probability-label error
- five-bin Expected Calibration Error (ECE) from observed bin mean predictions and class frequencies (bins with no cases remain unavailable)
- subgroup count, accuracy and error rate for two feature-defined groups split at the median of **training** X or Y (no validation-label-driven boundary selection).

### Counterfactual distribution shift
Users may simulate fixed X/Y offsets from -4 to +4. The current model is actually evaluated again on the shifted numerical input values; the UI reports prediction flip frequency, mean probability change and the **hypothetical** accuracy under the deliberately fixed-label assumption. This is not observed post-deployment drift and must not be used as proof of causal invariance.

Every scenario is read-only; there is no mutation of data points, fitted model weights, held-out test data, experiments or storage. The simulator works without accounts on GitHub Pages.

Four pure unit tests cover real Brier/ECE, empty-bucket behavior, subgroup errors, shifted probabilities and guardrails. Two desktop/mobile Playwright journeys validate full behavior under database and local-memory modes.

Limits: no production model telemetry, no real drift detection, no protected-demographic or fairness certification. Future extensions require consented real-world datasets, appropriate subgroup definitions and time-indexed production inference data.
