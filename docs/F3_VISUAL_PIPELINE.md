# F3 — Visual ML Pipeline Builder (first end-to-end implementation)

## Purpose
This builds on the existing browser-only Dataset Explorer instead of introducing new project storage or incompatible training engines. A user can import a bounded CSV or load a sample, choose two numeric feature columns and an actual binary 0/1 target, configure a deterministic pipeline and see the fitted transformations before navigating into the existing labs.

## Visual pipeline
The ordered stages are: **source column selection → seeded stratified train/validation/test split → optional mean/median imputation → optional standardization/min-max scaling → two-feature lab output**.

The form supports three split presets (70/15/15, 80/10/10, 60/20/20), seeds in the unsigned 32-bit integer range, optional no-imputation or no-scaling, and selected numeric features. These are actual transformations, not an illustrative fake pipeline.

The split uses the existing `createStratifiedSplit` implementation. A single pure `buildDatasetPipeline` function powers both the preview and the final transfer to Playground/Studio; no independent duplicate transformation is used for training. The output includes each original row's immutable ID, partition membership, transformed x/y coordinates, original target and serialized train-fitted pipeline.

## Anti-leakage contract
The imputer and scaler are fit **only on the training partition** and then applied unchanged to all rows. The validation and held-out test rows never contribute to fitted feature means, medians, standard deviations, minimums or maximums. Preview explicitly displays partition counts, training-only fitted means and medians, training missingness, and first-eight before/after rows. No label imputation, synthetic class labels or unapproved sample removal is performed.

A missing-value column with no imputation fails closed. Unsupported 2D feature types, missing/invalid/one-class targets, insufficient samples or invalid seeds are rejected with visible messages rather than pretending the dataset can be trained. A zero-variance scale uses the existing safe denominator convention. The existing test-access auditing remains unchanged.

## Verification
- Pure Node tests: reproducibility, 3-way membership, finite prepared data, train-only fit invariance under extreme changes to holdout samples, median imputation serialization, invalid pipeline settings and no-imputation failure.
- Browser tests on mobile and desktop, each in database and local-memory modes: sample preview, split/median/scaling changes, actual lab navigation, missing-value fail-closed behavior and invalid target warnings.
- Existing numerical, lint, MongoDB integration and browser suites must pass before merging.

## Scope boundary
This F3 slice preserves the current **two-numeric-feature binary classification** restriction in Playground and Studio. Arbitrary dimensionality, categorical one-hot encoders, model selection, server-side training and automatic cloud storage are future expansions, not represented as implemented here.

No AWS provisioning, production credentials or database migrations are required.
