# NeuroForge production development roadmap

Status: Post-review remediation implemented; verification and deployment gates are tracked separately. Earlier blanket completion claims are superseded by [Review remediation](REVIEW_REMEDIATION.md). The complete roadmap is not yet certified for production rollout.

## Product direction and scope

NeuroForge is a visual ML experimentation studio for learners and technically curious developers. Its core workflow is investigate a question, prepare data, configure a model, run an experiment, inspect its behavior, compare evidence, and record a finding.

The first production scope remains small classical algorithms and sequential dense neural networks. React/JSX, Express, MongoDB, and browser JavaScript/TensorFlow.js remain the foundation. Large training jobs, arbitrary executable uploads, enterprise collaboration, LLM training, and a general-purpose deployment platform are outside this roadmap's initial releases.

Guided and Expert views expose different levels of detail over the same underlying experiment. Guest entry remains available. Account ownership enables durable cloud projects and cross-device access.

The phases below are dependency order, not calendar estimates. Each phase includes implementation, verification, documentation, and a usable demonstration. Security, accessibility, numerical correctness, and observability apply throughout; they are not deferred to the last phase.

## Current baseline

Existing capabilities include numerical Playground solvers, TensorFlow training, seeded initialization, recorded Arena comparisons, dataset previews, basic Academy checkpoints, in-session undo, experiment saving/forking, browser ownership, and session checkpoint inspection.

The existing tests cover numerical behavior, HTTP ownership, persistence fallback, cancellation, tensor cleanup, and an XOR training scenario. Browser behavior was subsequently reported working by the user. Automated desktop/mobile browser coverage and isolated live MongoDB integration were established in Phase 0 and extended in Phase 1.

The existing Zustand store contains activeRun, savedRun, pendingRun, and one currentExperiment. It is not a durable project system. The Experiment MongoDB model retains compatibility fields and now stores a versioned domain envelope separating dataset versions, protocols, immutable runs and metric series. Draft revision APIs use a separate collection. Completed Studio runs now preserve model weights and topology for reopening and inference. Exact optimizer-state resume is not implemented.

The working tree already contains implementation changes. Establish a reviewed baseline before development; preserve unrelated files and do not overwrite existing work while introducing the new architecture.

## Phase 0 — Product contracts and baseline verification

Objective: establish a reliable reference and settle the behaviors that affect later architecture.

Work:

- Capture complete current workflows: guest entry, dataset editing, training, stop, save, report, fork, compare, and offline use.
- Reproduce those workflows against a real development MongoDB instance and with the database unavailable.
- Add an automated browser smoke suite against isolated test data. Record desktop and narrow-screen reference views.
- Inventory lint warnings and distinguish lifecycle concerns from unused code. Measure initial loading, Studio loading, training responsiveness, and repeated-run memory.
- Define desktop and mobile task expectations, supported dataset sizes, supported model shapes, sharing defaults, and artifact retention.
- Define quality budgets on a documented reference machine. Candidate targets: local draft recovery point within one second of an acknowledged edit, immediate visible response to Run/Stop, and no unbounded retained tensors over repeated jobs. Validate feasibility before treating numbers as release promises.

Deliverables: scope document, user journeys, terminology, baseline results, resource budget, and verification matrix.

Exit gate: all current critical journeys have known outcomes; data-loss paths and numerical discrepancies have explicit fixes or release blockers; browser and real-database verification can run repeatably.

## Phase 1 — Domain model and migration foundation

Objective: separate mutable investigation work from immutable scientific evidence.

Define versioned contracts for:

| Entity | Responsibility |
| --- | --- |
| Project | Research question, owner, title, tags, linked datasets and experiments |
| DatasetVersion | Immutable rows, stable sample IDs, feature/target schema, provenance, content digest |
| EvaluationProtocol | Task, explicit split membership, split seed, preprocessing contract, metric definitions |
| ExperimentDraft | Editable model/data choices, UI-independent settings, revision, autosave metadata |
| Run | Immutable configuration snapshot, execution state, timestamps, seeds, parent run, runtime versions |
| MetricSeries | Metric name, split, unit, step type, values, aggregation definition |
| ModelArtifact | Model topology/weights, digest, storage location, compatibility metadata |
| Annotation | Observation linked to a run, sample, chart range, or comparison |
| ShareLink | Explicit visibility, scope, expiration/revocation metadata |

Work:

- Separate draft dirtiness, sync status, run execution, model inspection, and save confirmation. A single status field must not represent all of them.
- Define execution transitions: queued, validating, running, stopping, completed, cancelled, failed, interrupted. Only expose pause/resume when the runner actually supports it.
- Establish stable client-generated IDs and independent seed roles for data generation, splitting, and model initialization.
- Specify canonical dataset serialization and a collision-resistant content digest, including feature schema and relevant preprocessing versions.
- Version API payloads; validate requests and stored records. Define error codes and revision-conflict responses.
- Introduce compatibility adapters for legacy experiment records. Preserve original values, label unknown provenance, and do not manufacture missing seeds, artifacts, or metrics.
- Define migration batches, retry behavior, verification counts, backups, and rollback. Avoid destructive migration on application startup.

Dependencies: Phase 0.

Exit gate: a legacy saved run can be read, migrated, and forked without changing its metrics; new completed runs cannot be mutated by later draft edits; invalid state transitions are rejected.

## Phase 2 — Workspace design system and interaction architecture

Objective: establish consistent, accessible interaction patterns before redesigning every page.

Work:

- Specify layouts for project overview, dataset preparation, Playground, Studio, Arena, run detail, and reports.
- Build reusable controls, form validation, dialogs, menus, tooltips, tables, status messages, empty states, and notification history.
- Design panel resizing, collapse/restore, minimum canvas sizes, focus mode, and persistent layout preferences. Use accessible resize controls rather than relying only on native CSS handles.
- Define Guided and Expert views using a shared configuration. Changing view must not change the experiment.
- Create a consistent chart system: axes/units, train/validation distinction, legends, linked cursors, zoom/reset, missing values, and accessible alternatives.
- Use one context inspector for selected points, layers, neurons, metrics, and runs.
- Keep class colors distinct from run-comparison colors. Include labels/shapes so color is never the sole carrier of meaning.
- Define narrow-screen behavior by task. Inspection, results, and lessons remain useful; advanced architecture editing may use a simplified interface.
- Cover keyboard navigation, focus return, dialog focus management, screen-reader labels, and reduced motion, including JavaScript animations.

Dependencies: Phase 1 entity/state contracts.

Exit gate: representative workflows work in the new shell using clearly labeled fixtures; keyboard users can operate essential controls; existing real training flows remain functional during incremental adoption.

## Phase 3 — Durable local drafts, autosave, and recovery

Objective: protect work before adding cloud synchronization.

Work:

- Move drafts, dataset snapshots, supported artifacts, and pending operations to a versioned IndexedDB repository. Keep localStorage for small preferences and compatibility migration only.
- Persist drafts through debounced writes with explicit pending/saved/failed states. A saved indicator appears only after the storage transaction succeeds.
- Retain bounded history and recovery snapshots. Restore the project, draft settings, selected dataset version, and last useful view after refresh.
- Prevent accidental overwrite from two open tabs. Detect newer revisions and offer explicit reload or duplicate-as-new-draft behavior.
- Handle storage quotas, private-browsing restrictions, corrupted records, schema upgrades, and interrupted writes with recoverable messages.
- Keep an operation outbox with stable operation IDs for future cloud sync. Do not represent a local write as a cloud save.
- Detect interrupted training after restart. Preserve configuration and available checkpoints; mark the run interrupted unless completion was recorded.
- Distinguish undo, revert draft, reset model weights, reset view, and new experiment.

Dependencies: Phases 1–2.

Exit gate: refresh and tab closure recover acknowledged drafts; storage failure is visible; two tabs cannot silently overwrite each other; a reload does not invent a completed training run.

## Phase 4 — Projects, identity, cloud persistence, and sharing

Objective: provide durable project ownership and reliable synchronization.

Work:

- Introduce project CRUD, archive/trash/restore, search, tags, and a project overview driven by real activity.
- Select the authentication approach during design. Prefer a maintained identity/session solution; do not introduce custom password cryptography. Specify secure sessions, account recovery, expiry, logout, and abuse controls.
- Replace anonymous browser ownership as the cloud authorization boundary. Keep the guest flow and provide explicit, idempotent migration of guest projects into an account.
- Enforce ownership on every project, dataset, run, artifact, and mutation endpoint. Possession of an arbitrary object ID must not grant private access.
- Add paginated listings and project-scoped filtering/sorting. Avoid fetching every run to render a table.
- Sync the outbox with idempotent operations, revision checks, retry/backoff, cancellation, and conflict handling. Preserve both versions on a conflict rather than merging scientific configurations automatically.
- Separate liveness from database readiness. Production must not silently accept durable cloud writes into temporary memory when MongoDB is unavailable.
- Make projects private by default. Add scoped read-only shares with revocation and optional expiry. Public reports expose only the approved snapshot and assets.
- Add export, retention rules, and reversible deletion. Account deletion and irreversible purge require explicit product flows.

Dependencies: Phases 1–3.

Exit gate: two accounts cannot access each other's private records; guest import does not duplicate or lose data; expired/revoked shares fail; offline edits synchronize without duplication; database outages produce honest storage status.

## Phase 5 — Execution service and persistent model artifacts

Objective: separate training from the page lifecycle and preserve usable trained models.

Work:

- Introduce a runner interface for validate, start, stop, progress, checkpoint, evaluate, and dispose. UI components subscribe to run state rather than owning the training job.
- Verify worker/backend support on target browsers before selecting the execution path. Use a worker where supported and a documented cooperative fallback where necessary; do not assume WebGL support is identical across environments.
- Start with one concurrent local training job, bounded datasets/models, and explicit memory/checkpoint limits.
- Add an activity drawer with job status, execution location, progress, stop controls, failures, and navigation back to a run.
- Guard against late callbacks, double starts, stale job updates, and disposal races. Navigation must have a defined continue/stop behavior; tab closure must produce an interrupted state.
- Persist topology, weights, preprocessing assets, and checkpoint manifests. Use object storage in production with metadata in MongoDB; define authenticated access, checksums, size limits, retention, and orphan cleanup.
- Support saved-model inference after refresh and explicit warm starts from compatible weights.
- Treat exact resume separately: it requires compatible optimizer state, step/epoch position, data ordering, and random state. Gate it by demonstrated runner capability; otherwise expose a clearly labeled new run from saved weights.
- Add early stopping with validation-based monitoring. Record whether final or best-checkpoint weights are used for evaluation.

Dependencies: Phases 1–4.

Exit gate: a trained model can be reopened and used for matching predictions within a documented numerical tolerance; stopping reaches a stable terminal state; navigation and repeated training do not leak resources; corrupted or incompatible artifacts are rejected.

Release milestone A: a dependable personal ML workspace. No advanced sweep system is required for this milestone.

## Phase 6 — Dataset preparation, feature engineering, and evaluation protocols

Objective: strengthen the scientific foundation for all advanced analysis.

Work:

- Add bounded CSV import with preview, column/type selection, target mapping, missing-value inspection, invalid-row feedback, and class/target summaries. Imported files are data only.
- Keep the first tabular training scope explicit. The initial visual lab may accept two numeric inputs and one target; broader feature counts require compatible model input shapes and explicit visualization semantics.
- Add a versioned sequential preprocessing pipeline: scaling, normalization, selected imputation, and simple derived features such as squared terms and feature products.
- Fit preprocessing on training data only. Store fitted parameters and apply them unchanged to validation/test samples and later inference.
- Introduce explicit train/validation/test membership, stratified classification splitting where feasible, split previews, seed controls, and small-class warnings.
- Define policy for final test evaluation. Hyperparameter selection and early stopping use validation; test access is labeled and recorded. Changing a configuration after viewing test results does not erase that history.
- Connect original and transformed data views. Mark whether a plot shows raw features, transformed features, a slice, or a projection.
- Update model input-shape validation and inference together with feature engineering; adding a feature cannot remain a visualization-only change.

Dependencies: Phases 1, 3–5.

Exit gate: training-only preprocessing is verified against a leakage fixture; a dataset/version change invalidates the old result; saved preprocessing reproduces inference; mismatched feature schemas are blocked.

## Phase 7 — Error Explorer and linked sample analysis

Objective: make model failures an inspectable product experience.

Work:

- Persist or reproducibly reconstruct per-sample predictions linked to stable sample IDs, run/artifact version, evaluation split, and decision threshold.
- Add correct/incorrect overlays, confidently wrong examples, low predicted-probability margins, and selected-region analysis. Do not label model probability as a guaranteed measure of uncertainty.
- Link confusion-matrix cells to samples, sample selections to the plot, and plot selections back to the inspector.
- Add regression residual plots, predicted-versus-observed plots, and examples with large errors.
- Provide class and user-selected slice metrics with sample counts and small-sample cautions. Do not claim fairness from a small slice analysis.
- Let compatible runs reveal shared errors, corrected errors, and newly introduced errors on the same held-out samples.
- Save annotations tied to samples or chart regions. Findings remain linked to the original run even after new experiments are created.

Dependencies: Phases 5–6.

Exit gate: every displayed error resolves to a real recorded prediction; linked selections agree; threshold-specific evaluations do not silently overwrite the original run's reported metrics.

## Phase 8 — Neural Studio diagnostics

Objective: turn the architecture editor into a model-debugging environment.

Work:

- Show validated layer shapes and actual parameter counts. Keep sequential dense networks as the supported architecture.
- Add layer reordering with shape validation, clearer architecture presets, and complete keyboard alternatives for selection and inspection.
- Implement selected-sample forward-pass walkthroughs with actual weights, biases, pre-activations, and activations.
- Add bounded activation, weight, and gradient summaries at recorded steps; include distribution views and inactive-ReLU diagnostics.
- Add a backpropagation walkthrough for a supported small model/sample or batch. Label gradient aggregation and checkpoint provenance.
- Make checkpoint selection consistent across network values, boundary plots, inspector values, and displayed epoch. Preserve final-run metrics as separate evidence.
- Record diagnostic sampling policy to control overhead. Expensive diagnostic recording is opt-in or capped.
- Consider a sampled loss slice only after diagnostics work. Label its parameter directions and fixed parameters; never imply it represents the full high-dimensional loss surface.

Dependencies: Phases 5–6; shared sample selection from Phase 7 is reused.

Exit gate: inspector values match independent forward-pass calculations; gradients match small reference/finite-difference checks within tolerance; checkpoints show internally consistent state without modifying the completed run.

Release milestone B: a differentiated visual investigation studio with feature engineering, failure analysis, and network diagnostics.

## Phase 9 — Advanced Arena, repeated trials, and bounded sweeps

Objective: support controlled investigation across configurations and randomness.

Work:

- Add multi-run selection, pinned baselines, searchable run tables, parameter diffs, saved comparison views, and linked chart ranges.
- Build a compatibility matrix for task, dataset version, evaluation membership, preprocessing, metric definition, aggregation, and execution completion. Distinguish valid model comparisons from claims that isolate one causal change.
- Group repeated runs by configuration while varying model seeds independently from dataset/split seeds. Show trial count, mean, dispersion, and individual traces. Do not promise significance from a few runs.
- Add a sweep preview with explicit candidate configurations, seed repetitions, total job count, and resource budget. Start with grid search and sequential execution.
- Use a configurable total-job cap; count repeated seeds toward that cap. For example, nine configurations with five seeds are 45 jobs, not nine.
- Persist the sweep manifest and individual job states. Resume pending work after interruption without duplicating completed runs; one failed run must not discard the group.
- Rank using validation metrics. Keep final test evaluation outside the tuning loop.
- Add metric-versus-model-size and metric-versus-training-time views. Time comparisons include device/backend context.
- Provide separate clustering analysis with relevant metrics and data assumptions; do not reuse classification accuracy views.

Dependencies: Phases 4–8.

Exit gate: every sweep result traces back to one immutable manifest entry; retries are idempotent; incompatible comparisons cannot silently produce rankings; repeated-trial aggregates match stored runs.

## Phase 10 — Investigation-based learning and evidence-backed reports

Objective: connect learning, experimentation, and communication.

Work:

- Build versioned challenge templates with prepared datasets, supported configuration ranges, hints, completion rubrics, and linked explanations.
- Introduce investigations such as hidden-layer necessity, learning-rate divergence, leakage diagnosis, and validation-based overfitting analysis.
- Store attempts, progress, and feedback in the user's project/account, while preserving guest-local progress.
- Grade understanding and relevant outcomes. Avoid brittle exact floating-point thresholds and rewarding test-set optimization.
- Create reports composed of pinned real charts, configuration differences, selected samples, observations, and limitations. Preserve snapshot/live-report distinctions.
- Make report sharing follow project permissions, with export and revocation.
- Expand the guided interview route to create a real baseline, train a variant, inspect an error, compare evidence, and present a report.
- Evaluate an AI tutor only after experiment context and evaluation are dependable. If added, limit it to authorized selected data, ground claims in actual records, disclose generated text, and require explicit user action before launching or changing experiments.

Dependencies: Phases 4 and 6–9.

Exit gate: completing a challenge produces a reproducible investigation; a report's claims resolve to its referenced data; private assets cannot leak through public reports.

## Phase 11 — Production readiness and controlled rollout

Objective: demonstrate operational reliability for the chosen release scope.

Work:

- Run the full critical-journey suite against supported browsers/viewports and a real MongoDB environment.
- Exercise account isolation, revoked shares, malformed input, quotas, offline edits, storage exhaustion, simultaneous tabs, network timeouts, retries, database outages, and cancelled jobs.
- Add structured diagnostics with request/run IDs, health/readiness endpoints, error tracking, and actionable user-facing recovery. Exclude raw private datasets, credentials, and share tokens from logs.
- Profile large allowed datasets, prolonged use, many checkpoints, and repeated model disposal. Enforce execution/storage budgets.
- Perform keyboard and assistive-technology checks, reduced-motion testing, readable-chart checks, and touch-target review.
- Rehearse migration, artifact retention, backup restoration, and application rollback. Preserve data-schema compatibility across the rollback window.
- Use staging, scoped feature flags, and a limited beta before broad release. Keep advanced features disabled when their verification gate is incomplete.
- Publish deployment settings, supported limits, browser execution constraints, recovery procedures, privacy behavior, and known limitations.

Exit gate: critical journeys pass; no known issue can silently lose acknowledged work, corrupt scientific evidence, bypass ownership, or present uncomputed results as measurements; restore and rollback have been exercised.

Release milestone C: advanced experimentation and learning features released only after their individual gates and the production readiness gate pass.

## Delivery rules for every phase

1. Start with a small written contract and reviewable interaction example.
2. Implement a complete vertical path across storage, computation, API, and UI where applicable.
3. Preserve existing working journeys or provide an explicit compatible migration.
4. Add focused tests for numerical correctness, state transitions, persistence, authorization, and user behavior as relevant.
5. Demonstrate the feature using real data and real measurements.
6. Record limitations and operational behavior.
7. Release behind a feature flag when rollout or migration carries meaningful risk.

Do not treat an attractive screen, a passing build, an endpoint returning 200, or a mocked database check as sufficient evidence of production readiness.

## First implementation slice after planning

After the Phase 0 contracts and evidence are complete, the first implementation should be one guest project containing a dataset version, recoverable draft, completed immutable run, and reopened report. That path validates the new domain model and local durability before accounts, diagnostics, and sweep features multiply the state space.
