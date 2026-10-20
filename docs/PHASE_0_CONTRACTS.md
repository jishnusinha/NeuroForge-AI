# Phase 0 product and verification contracts

## Scope frozen for the next milestone

NeuroForge remains a guest-accessible visual ML learning and investigation product using React/JSX, Express, MongoDB, and browser TensorFlow.js. The initial investigation domain is generated/editable two-dimensional data, selected classical algorithms, and sequential dense binary classifiers.

Guided and Expert views will expose different amounts of information over the same experiment. Desktop supports construction and analysis; mobile must preserve usable inspection, results, lessons, and simplified controls. Arbitrary code execution, large-model training, and real-time multiuser editing are excluded from the first milestone.

## Baseline capabilities and limits

| Area | Current contract |
| --- | --- |
| Inputs | Finite 2D numerical points; binary labels for classification |
| Dataset bound | At most 2,000 samples for saving and neural training; manual point creation enforces the same cap |
| Neural architecture | Two inputs, up to four hidden dense layers, one sigmoid output; at most 16 units per layer |
| Training | 1–500 epochs, batch size 1–128, Adam/SGD/Momentum; one Studio training job per mounted workspace |
| Reproducibility | Seeded data/split/initialization; runtime/backend metadata; numerical backend differences remain possible |
| Checkpoints | Session inspection only; periodic capture at bounded training lengths; no claim of persisted optimizer resume |
| Save | Only a completed current result; actual parameters, data, metrics, and history |
| Share | Public read-only report links; local-only results require export; private account projects belong to Phase 4 |
| Offline | Explicit browser-local save; a storage failure must not produce a success confirmation |
| Development database outage | Temporary server memory is allowed and identified as nondurable |
| Production database outage | Readiness and experiment operations return 503; no silent memory writes |

## State meanings

- Draft: editable inputs and configuration. The current application does not yet durably autosave drafts.
- Run: one execution of a fixed configuration. Later draft edits invalidate the live result for saving.
- Completed: execution finished; this does not imply convergence, optimality, or good generalization.
- Stopped: the training task reached a stable stopped state after a stop request; it is not a resumable paused job.
- Saved locally: a browser-storage write succeeded. It does not imply cloud durability or portability.
- Saved to database: the API acknowledged MongoDB persistence.
- Temporary memory: an explicitly nondurable development mode.
- Checkpoint inspection: viewing recorded weights without replacing the completed run's reported final metrics.

## Critical user journeys

| Journey | Required evidence |
| --- | --- |
| Guest entry | Landing link opens working lab; keyboard commands open and select the intended experiment |
| Dataset edits | Draw and undo change inputs and disable saving an outdated result |
| Classical fit | Model recalculation completes without an update loop; appropriate numerical metrics exist |
| Neural training | Real history and checkpoints are produced; moving the probe preserves learned state |
| Stop | No second overlapping fit; save is disabled for an incomplete job |
| Save/reopen | Report survives reload, resolves by share ID without owner's local cache, and exports JSON |
| Fork | Dataset and parameters are restored into a new draft; original report remains unchanged |
| Compare | Matching protocol allows real curves; differing splits prevent direct comparison |
| Offline/error | Local success and storage failure have different visible outcomes |
| Narrow layout | Main document does not overflow horizontally and the primary canvas remains usable |

## Quality gates

The following gates are blocking now:

1. Unit/regression tests pass, including numerical behavior, repeatable XOR learning, and bounded tensor retention across repeated jobs.
2. Lint succeeds with warnings treated as failures.
3. Real MongoDB integration verifies save, reconnect, share lookup, ownership, deletion, and readiness behavior.
4. Chromium desktop and mobile browser journeys pass against the production build in both database and temporary-memory modes.
5. Reference screenshots are reviewed for misleading scientific rendering, collapsed visualizations, and unusable layout.
6. Build and whitespace checks pass. Outstanding resource warnings are recorded rather than hidden by increasing warning thresholds.

The following are candidate service targets to validate during their implementation phases, not capabilities claimed today:

- Phase 3: acknowledge local autosave only after commit; aim for recovery within one second of an acknowledged edit on the documented reference environment.
- Phase 5: show Run/Stop feedback promptly and keep interaction responsive under supported execution workloads.
- Phase 5: bound checkpoint/artifact retention and verify repeated-job memory behavior in supported browser backends.
- Phase 11: define and validate production load/latency budgets against representative hosting and target hardware.

## Recorded limitations and release dependencies

Current drafts are lost on full reload; saved results remain available. This is an explicit Phase 3 dependency, so the product must not advertise autosave or crash recovery yet. Browser ownership is not account authentication. Exact resume and trained-model persistence are Phase 5 dependencies. Test-set isolation, richer evaluation protocols, and feature engineering are Phase 6 dependencies.

The TensorFlow Studio chunk remains large. Route splitting prevents it from loading with the landing page/Playground, but performance observations on a local software-rendered Chromium browser are not production latency guarantees.

## How verification runs

- `npm test`: numerical, storage, API, training, and repeated-disposal regressions.
- `npm run lint`: client lint, with warnings denied.
- `npm run test:integration`: real isolated MongoDB integration.
- `npm run test:e2e`: production build plus desktop/mobile Chromium journeys backed by real MongoDB.
- `npm run test:e2e:memory`: the same browser journeys without MongoDB.
- `npm run check`: unit tests, strict lint, real MongoDB integration, and database-backed browser journeys.

Install root, client, and server dependencies, then run `npx playwright install chromium`. Tests use an installed `mongod`, `NEUROFORGE_MONGOD_BINARY`, or `NEUROFORGE_TEST_MONGODB_URI`. Even with an externally supplied test URI, each invocation uses a unique `neuroforge_test_*` database and checks its exact name before dropping it. Local MongoDB subprocesses bind only to loopback and use verified temporary cleanup paths. Normal application data is not used.

Browser ports default to 4179; override `NEUROFORGE_E2E_PORT` when needed. Each browser test gets a fresh storage context. Reports, screenshots, traces on failure, and measurements are written under ignored `.artifacts/e2e-database` and `.artifacts/e2e-memory` directories. CI retains those artifacts for review.
