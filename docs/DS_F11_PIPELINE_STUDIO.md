# DS-F11 — Visual Data Pipeline Studio

> New data-science roadmap milestone, distinct from the earlier F3 Visual ML Pipeline Builder and historical phase numbering.

## Overview

The F11 Studio extends the existing Dataset Explorer at `/app/datasets`, below the F3 CSV preparation controls. Click **Advanced Pipeline Studio (F11)** after importing a CSV or loading the two-moons sample.

This release adds an actual executable, bounded, ordered pipeline; it is **not** a visual-only diagram or a general-purpose cyclic DAG editor. The existing F3 pipeline and its entry points remain available and unchanged for backward compatibility.

### Capabilities delivered

- Feature/target selection and seeded 70/15/15, 80/10/10, 60/20/20 splits.
- Editable ordered step list with keyboard-operable configuration, add, remove, move up/down, duplicate and enable/disable controls.
- **Numeric imputation** (training mean, training median, user constant).
- **Numeric scaling** (training standard deviation, min-max, training median/IQR).
- **Categorical imputation** (training mode or user constant).
- **One-hot encoding**, deterministic training-only vocabulary, eight categories per column, configurable unseen/missing category policy.
- **Numeric feature engineering** (per-feature squares and two-input interactions).
- Real train-fitted parameter inspection, per-stage output schema, split membership and source-to-prepared row preview.
- Local saved recipe in the existing owner-scoped IndexedDB snapshots, with errors surfaced rather than silently claiming saving.
- JSON import/export of bounded recipes. Recipes contain configuration only and do not include source rows or fitted parameter values.
- Reproducible frozen fitted artifact capable of applying the **same** transformations to future observations via `transformStudioArtifact`.
- Explicit compatibility gate and launch to existing Playground/Studio **only** when two original numeric features remain the two output columns and labels are observed 0 and 1.

## Execution design

1. Validate source headers, stable row IDs, selected input roles, graph operators and supported options.
2. Construct the deterministic stratified train/validation/test membership **before** any fitting.
3. Execute enabled nodes in order. Fit each node using only already-transformed **training** rows.
4. Apply the same frozen parameters to train/validation/test without refitting.
5. Reject non-finite prepared numeric features, unsupported source/target schemas, unknown categories (when configured to error), generated name collisions, and output dimensionality exceeding the feature budget.
6. Produce the measured preview and fitted artifact.
7. On explicit launch, replay the artifact over original rows and compare its full result to the preview before handing off compatible x/y coordinates and recorded membership.

**Validation and test rows never contribute to fitted means, medians, modes, category vocabularies or scaling parameters.** The label is excluded from feature transformations.

## Compatibility boundary

The existing F3 `buildDatasetPipeline`, `PreprocessingPipeline` and stored model formats are not replaced or retroactively rewritten. The F11 executor is a separate versioned artifact stored alongside the run. The current 2D labs do not support N-dimensional inputs or arbitrary categories; such prepared matrices can be inspected and exported as recipes, but their launch buttons are disabled with the reason shown. Broader models are planned for F12.

The initial default F11 recipe reproduces F3 mean imputation + standardization and split membership when configured with two numeric inputs and a binary target. Existing tests verify equivalent transformed points.

## Resource/privacy boundaries

- **Input**: CSV up to 2 MiB, 2000 observations and 20 source columns, unchanged.
- **Pipeline**: at most 16 transformation nodes; maximum 20 output numeric features; at most eight training categories per one-hot encoded input.
- **Execution**: browser-local; no automatic server upload or Python execution.
- **Persistence**: one last-saved owner-scoped local recipe per browser account for a matching dataset fingerprint. Export/import supports multiple user-managed recipes. No automatic dataset restoration or raw-row persistence is introduced.

## Verification

- `tests/pipeline-studio-f11.test.mjs`: deterministic splits, equivalence with the existing F3 engine, train-only fitting under held-out perturbations, operator ordering, disabled stages, categorical vocabularies and unknown handling, robust scaling, polynomial/interaction replay, graph validation, and resource guards.
- `tests/e2e/pipeline-studio-f11.spec.mjs`: editable preview, recipe persistence and export, exact legacy lab launch, categorical expansion compatibility messaging, reorder/failure/recovery and Studio launch on desktop and mobile.
- Full release must pass `npm run check`, `npm run test:e2e:memory` and the repository's verification summary.

## Future follow-ups, not implemented

Arbitrary multi-branch DAGs with merge semantics, dataset joins, target encoding, train-only learned feature selection, categorical cardinality above the current bound, N-dimensional training (F12), worker execution for larger datasets, shared server-side pipeline recipes and complete reproducibility of cloud runtimes.
