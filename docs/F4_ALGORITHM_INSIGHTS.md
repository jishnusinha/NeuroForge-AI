# F4 — Algorithms Insights (CART and PCA)

## What ships
An additional Algorithms tab in the existing browser-based Workbench with two fully computed techniques.

**CART/Gini decision tree:** seeded stratified training/validation/test partition using 2 selected finite numeric features and an observed 0/1 target; deterministic greedy binary thresholds, at most depth 5, min leaf size 2. Balanced zero-gain branching is allowed only when there is another level for learning interactions such as XOR, and the depth/leaf constraints bound overfitting and computation. The UI reports validation accuracy, actual rule paths, sample counts and normalized impurity-reduction feature importance. Test labels are not evaluated during model fitting or displayed as score.

**Two-variable PCA:** mean-centers all complete observed feature pairs, calculates the 2×2 sample covariance, computes ordered eigenvalues/eigenvectors, and plots up to 300 original-row projections with an accessible data table. All displayed variance ratios come from observed data. PCA here is explicitly **exploratory fit on available data**, not a training-only transform to be applied later to held-out evaluation rows. It is not connected to the lab modeling pipeline.

## Safety and scope
Both algorithms are local, bounded and deterministic. The decision tree excludes missing/nonbinary rows **before** splitting and explicitly reports how many. It does not automatically impute or resample. The PCA warns on insufficient complete pairs and zero variance. Neither algorithm modifies imported CSV rows, existing algorithms, saved runs, or cloud services.

Unit tests cover XOR, deterministic tree training, depth and invalid data, PCA covariance/rank behavior, and missing-pair handling. Desktop/mobile browser tests cover both visual modes. Complete CI in database and memory modes must pass before merging.

Future algorithm enhancements: multiclass trees, arbitrary-dimensional PCA, DBSCAN, integration with saved experiments, cross-validation and threshold sweeps.
