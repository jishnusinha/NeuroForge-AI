# F5 — Model-backed What-If Lab and bounded counterfactual search

A new What-If Lab appears below the Playground's measured results after the Logistic Regression or KNN model has been run and is not stale. It is hidden when no fitted classifier can supply `predictProbability(x,y)`. Inputs are controlled numerical X/Y probes based on training-feature bounds; no training data or model parameters are modified.

The live probability, decision threshold, predicted class and finite-difference sensitivity for positive X/Y steps come from actual trained-model calls.

An explicit **Find nearest class flip** action queries a bounded normalized 2D grid, selecting the shortest normalized candidate whose real inference crosses the decision boundary. Users can lock either feature and choose search radius. The grid is intentionally capped (12 steps each way, at most 624 evaluations) and clips to the training-feature range with a 20% margin. Absence of a flip produces a clear negative search result instead of an invented counterfactual.

Counterfactual means a model-prediction change under the probed feature modifications, **not** a causal explanation, guaranteed feasible intervention, globally nearest point, or proof of real-world outcomes. The lab does not inspect held-out labels and does not bypass stored-run attribution.

The pure `whatIf.js` functions are covered by unit tests for true probabilities, sensitivity signs, bounded flips, locked dimensions, no-flip conditions, and invalid model output. Desktop/mobile browser tests exercise a genuine freshly fitted Playground model in both database and local-memory CI modes.

No AWS deployment, production secrets, neural training architecture, saved artifacts or database schema changes.
