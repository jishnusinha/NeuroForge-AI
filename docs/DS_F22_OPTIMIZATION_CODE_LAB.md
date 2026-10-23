# F22 — Optimization & Code Laboratory

F22.0–F22.5 are implemented locally. The follow-up instruction to complete the remaining phases supersedes the earlier first-phase-only handoff. No backend endpoints, production databases, cloud resources, or existing research receipt formats were changed. External pull requests, merges and deployment are separate from these local changes.

## Open the laboratory

Use **Optimization Lab** in the sidebar or command palette, `/app/optimization`, or **Open 3D Optimization Lab** beneath Studio's existing F8 simulator. Pages uses `#/app/optimization`. The route, Three.js 0.180.0 renderer, and code templates load lazily. The homepage does not load Three.js.

1. Select Multiwell, Adam, a learning rate and starting coordinates, then **Compute experiment**.
2. Read the numeric loss legend and stationary-point table. The surface contains four global minima, a local maximum, and four saddles. Its boundary samples are not global maxima.
3. Orbit, pan and zoom with pointer controls or the camera buttons. Reset camera restores the initial viewpoint.
4. Use Play/Pause, Replay, Next/Previous update, speed and the cursor. Snap mode shows discrete updates; smooth mode interpolates parameters for display only. The inspector shows the last completed numerical update.
5. Select up to three optimizers and compute a synchronized race. Compare the same objective, initial point, requested budget, seed and color scale. Terminated traces stay at their last valid state. Freeze/Resume controls independently pause each displayed participant; numerical histories remain immutable.
6. Inspect the full-gradient, gradient-used-for-update, optimizer memory and sampled training indices. Download exact trace JSON/CSV, a map SVG, atlas PNG, or executable Python/JavaScript.

Editing settings does not silently recompute the displayed experiment. Compute applies validated settings atomically. The parameter/race panel is collapsible, including on mobile. The initial state is paused. Hidden/offscreen playback pauses; reduced motion forces discrete updates. The 2D map, loss timeline, tables and exports work without WebGL. Context loss releases the scene; toggle 3D graphics to retry.

## Numerical contracts

| Objective | Definition and interpretation |
| --- | --- |
| Convex bowl | `0.5(x²+6y²)`; unique global minimum at `(0,0)`; no finite maximum |
| Multiwell | `(x²−1)²+(y²−1)²`; four global minima `(±1,±1)`, local maximum `(0,0)`, four axial saddles |
| Rosenbrock | `(1−x)²+100(y−x²)²`; global minimum `(1,1)`; no finite maximum |
| Saddle | `x²−y²`; indefinite Hessian at origin; unbounded above and below |
| Seeded linear/logistic | Exact training-only objective on the first 32 of 48 deterministic examples, with recorded regularization and parameterization |
| Neural slice | Two output weights of a frozen synthetic tanh network; fixed hidden weights, data and output bias. This is not global full-network loss or actual Studio optimizer telemetry |

Analytic gradients and Hessians are tested with finite differences. Known critical points use Hessian classification; an inconclusive Hessian is unknown. Dataset objectives do not invent analytical stationary points. The LCG is `state = (1664525*state+1013904223) mod 2^32`.

GD uses full gradients. Mini-batch SGD samples actual training indices with replacement from a recorded seeded stream and is unavailable for objectives without examples. Momentum uses `v=μv+g`. Nesterov uses the explicit look-ahead `g=∇L(θ−αμv)`, then the same velocity update; it is not labeled equivalent to PyTorch SGD's Nesterov variant. AdaGrad starts from zero accumulation. RMSProp is uncentered with configurable β₂. Epsilon is outside the square root. Adam corrects both moment biases. AdamW applies decoupled decay to pre-step parameters, separately from objective regularization.

Each immutable trace retains validated configuration, objective/version, seed, sampling metadata, full-objective loss/gradient, used gradient, update, available optimizer memory, finite status, evaluation counts and stopping rule. Its `f22-v1-...` fingerprint is a deterministic FNV configuration/version checksum, not a security digest. No unavailable moment is fabricated.

Converged means the full-gradient norm meets the documented tolerance for deterministic methods. Stationarity can also be a maximum or saddle; it is not proof of optimality. SGD has no convergence claim. Exhausting the requested budget means completed. Non-finite/overflow updates or leaving the permitted parameter domain stop at the last valid state, with diverged/out_of_domain status. Exports never replace failed updates with clipped coordinates.

The F8 adapter preserves its existing API, numerical bounds, default trajectories and tests. Its historical `sgd` argument still means full-gradient descent, while the new lab's `sgd` means actual mini-batch SGD.

## Graphics and playback

The indexed mesh defaults to 97×97 vertices, with 49×49 and 161×161 options. Vertex loss, color, paths and marker coordinates derive from the same objective. Vertex colors use an unlit, ordered purple/blue/green/yellow scale so lighting does not alter their numeric meaning. Recoloring updates the existing color attribute; optimizer changes replace only trajectory resources. The mesh is regenerated for objective/domain/grid changes.

World coordinates are explicitly `(x, (L−sampledMin)/(sampledMax−sampledMin)*3, −y)`. This linear display normalization is shown next to the surface and does not change exported numerical loss. Height and color ranges are separately recorded. A shared numeric color range applies to every race participant; the optional range includes 0–5 without clipping numerical values. The 2D contour isolines interpolate measured grid samples for display only.

Marker centers lie at the exact objective value, including during display interpolation; completed steps match trace records. A contrasting halo remains visible through terrain. Diamonds, triangles, crosses and text distinguish stationary points. The accessible table provides their exact coordinates, losses and Hessians.

Rendering is on demand with at most one pending scene animation frame. Camera, resize and playback events request frames. Offscreen/hidden views cancel pending frames. Scene cleanup disposes geometries, materials, label textures, controls, renderer, observers, listeners and graphics context. Desktop playback requests approximately 60 updates/second in smooth mode; mobile requests 30. This scheduling target is not a measured hardware FPS guarantee.

**Record scene benchmark** exports initialization time, vertex/geometries count, frame intervals, median CPU render submission time, optional heap size and viewport/pixel ratio/reduced-motion profile. Frame intervals include idle periods; do not interpret them as a hardware FPS benchmark. Browser tests exercise both mesh budgets and verify replaced contexts are lost. Mid-range physical-device FPS, manual assistive-technology testing and published Pages verification remain release-signoff activities.

## Universal code companions

| Destination | Available example |
| --- | --- |
| Playground | OLS/GD linear regression, logistic, kNN and K-means |
| Neural Studio | Configured dense layers, activations, shapes, SGD/momentum/Adam, actual backward/step/evaluation, synthetic in-memory checkpoint |
| F12 | Baseline, N-feature ridge/logistic/softmax/kNN/CART/forest, regression or supported classification tasks |
| F15 | Exact configured candidate list, fold count and metric; runnable fold-safe synthetic Python/JavaScript recipes with sealed holdout |
| F19 | Separate selected-model example entry; plotting code remains evidence reproduction |
| F20 | Selected archived-model example, explicitly separate from saved-run replay |
| Academy | Inspect-code entries in lesson cards, with a dedicated optimization link |
| Optimization Lab | Exact mathematical objective and trace reproduction in scratch PyTorch, framework PyTorch, or standalone JavaScript |

The shared panel provides conceptual explanations, source, shapes, recipe/provenance, observed evidence, line numbers and copy/download controls. ML/DL examples use 40 LCG-generated rows: 32 train and 8 validate. F15 examples use 120 generated rows: 96 inner-CV and 24 sealed holdout rows, deterministic stratified/round-robin example folds, fresh fold-specific preprocessing and no holdout evaluation. Their source fold membership and F11 transformation recipe are unavailable, so these remain synthetic protocol analogs.

Allowlisted context normalization strips source observations, original feature names, row IDs, split membership, fitted preprocessing, saved weights, tokens and arbitrary extra properties. No generated code executes in the browser. Mathematical optimization exports are exact; source-data model replay is not claimed. Observed browser metrics remain separate and are excluded from example exports. Browser early stopping and historical model checkpoints are not reproduced.

Dependencies: Python 3.12, NumPy 2.2.6, CPU PyTorch 2.5.1, scikit-learn 1.7.2 where appropriate; Node.js 24 and TF.js 4.22.0 for TF.js examples. Classical Python framework examples use scikit-learn; softmax and dense examples use PyTorch. JavaScript is downloaded as `.mjs` for standalone ES-module execution. Initializers, tree tie conventions and framework solvers differ; numerical identity is claimed only for explicitly verified recipes.

Readable exported JavaScript uses checked source templates, preserving function names and formatting through production minification. After changing the numerical or classical example kernels, run `node scripts/sync-optimization-code-source-f22.mjs`; its `--check` mode runs in the numerical test suite and rejects stale copies.

## Verification

```text
npm test
npm run lint
npm run build:client
npm run fixtures:f22
node scripts/export-optimization-fixtures-f22.mjs
python scripts/verify-learning-code-f22.py
python scripts/verify-optimization-f22.py
node scripts/export-python-chart-fixtures.mjs
python scripts/verify-python-charts.py
npm run test:integration
node scripts/run-browser-tests.mjs memory
node scripts/run-browser-tests.mjs database
```

CI runs the Python fixtures and existing chart gates before the full domain/storage/browser suite. Local Python execution was verified using an isolated runtime under ignored `.artifacts/f22/python/`; no system Python installation is required by the app. Numerical evidence covers 34 learning scripts, 16 optimization configurations in both scratch and framework implementations, seven search recipes in each language, and all 42 existing Python chart families. Node tests cover finite-difference gradients, extrema, independently calculated early steps, adaptive state, SGD integrity, divergence, immutable races, mesh/ball projection, exact standalone exports and privacy.

Local verification records, scene benchmarks and remaining release-signoff limits are in [F22 verification](DS_F22_VERIFICATION.md). No external deployment or PR/merge is claimed by this implementation.
