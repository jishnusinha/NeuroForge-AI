# CSV Academy and Themes implementation

This implementation adds local CSV profiling, ten reproducible Academy cases, ten appearance themes, and simpler product navigation.

## CSV import behavior

`DatasetPreparation` sends selected local files to a dedicated Web Worker. The worker parses supported delimited text incrementally, reports byte/row progress, computes per-column numeric summaries over every parsed data row, retains the first 100 records for inspection, and builds a deterministic reservoir sample of at most 2,000 records for explicitly opted-in model preparation. It supports UTF-8 (including BOM), UTF-16 LE/BE and ISO-8859-1, comma/semicolon/tab delimiters, quoted fields, and decimal comma/period. The file stays in the browser. The composite source fingerprint is an integrity hint, not a cryptographic digest.

The separate **Full source pages** view browses 100-row pages in a cancellable Worker. Its filters scan the complete source and support text contains/equality, numeric greater/less, and missing-value checks. Sorting retains at most 10,000 value/row-number entries per pass in a successor heap, then retrieves the selected rows in the measured sort order. It has no row cap within the 100 MiB file budget. Deep sorted pages require additional full-source passes. Numeric and text values use an explicit total order (numeric before text in ascending order), missing values remain last in both directions, and source-row order breaks ties. English numeric collation orders text.

Cells can be edited across pages in a fingerprint-bound local overlay (up to 4 MiB). Filtering, sorting, full-source fitting, and newly selected model samples all consume the edited values directly. The overlay is synchronized across mounted views and same-origin tabs. It can also be exported as a patch or rebuilt into a new full CSV. The original file is never mutated. A fitted investigation freezes its file, parsing configuration and edit snapshot; later edits require a new investigation to change its fitted population. If edits change after selection of a visual-lab sample, that sample must be explicitly selected again before modeling. Direct integration with the row-array DataSheet's undo/version history remains a separate contract.

Files are limited to 100 MiB and 100 columns; malformed records stop parsing. The DataSheet working copy remains bounded at 2,000 rows and 100 columns. The imported profile describes the original parsed file, not subsequent edits. EDA charts identify the bounded inspection/sample population they use.

## Full-source model fitting

From the whole-file profile choose **Open full-source model fitting**. Supported models are a training-only baseline (binary/multiclass classification or regression), binary logistic regression, and ridge regression. Select 1–20 numeric source features and a separate observed target. No reservoir sampling is used in this path. Other model families and arbitrary F11 recipes continue to use explicit samples in the existing visual workbenches; this path does not silently substitute a different algorithm.

The worker validates every row, discovers target classes, and makes an exact deterministic train/validation/test partition. Classification uses a seeded affine permutation within each class; regression permutes all source rows. The split method, seed, preset, class sizes and boundaries are versioned. Every class needs at least three observations, and classification supports at most 12 classes. This permutation is reproducible and bijective, not a uniform draw from every possible permutation. Missing or invalid targets, nonnumeric observed inputs and all-missing training features stop fitting rather than dropping rows.

Training-only online moments fit mean imputation and population standardization after imputation. Baselines use training label counts/means; ridge accumulates the normal equations with an unpenalized intercept; logistic uses the same full-batch L2 gradient objective, learning rate 0.25, as F12. Each logistic epoch rescans the file. Training retains O(features² + classes²) state, in addition to bounded parsing buffers and the edit overlay. It retains at most 20 prediction examples per evaluated partition. More epochs and larger sources take longer; execution reports progress and can be cancelled by terminating the worker.

Only validation is scored after fitting. The fitted worker owns a one-time final-test gate and an immutable source snapshot. A test request verifies the source digest before scoring, consumes that gate even if it fails, and prevents another attempt in that investigation. Starting a new investigation is an explicit local reset; it is not a tamper-proof global test lock.

Full-source results save through the existing owner-scoped F14 experiment repository and work with F20 comparison rules. Receipts contain aggregate metrics, exact counts, model configuration and source/split/pipeline/schema digests. Fitted baseline/logistic/ridge artifacts are stored only with opt-in and support existing numeric-vector replay. Standard evidence downloads exclude raw rows, edit values, prediction examples and model parameters. Saving before the final test updates the receipt with the successful access event after test evaluation; archive failures are reported and can be retried.

Source identity uses a SHA-256 chain over fixed 1 MiB raw-byte blocks (initial 32 zero bytes), then hashes a canonical object containing the final chain, file length, normalized parsing options and edit overlay. This is explicitly **not** a standard whole-file SHA-256. Split identity includes this source digest and the complete split definition, so different edited sources cannot be ranked as the same evaluation population.

## Academy cases

Ten deterministic synthetic cases include a generated CSV, data dictionary, accessible SVG relationship illustration, and Python reproduction script. Downloads are generated from the same seeded data. Supported cases can be opened in the existing data preparation or clustering workflows. Python script contents are provided as reproducibility artifacts; they are not executed as part of this implementation's verification.

## Themes and navigation

The picker offers ten stable theme IDs (including the original four), mode metadata, palette previews and local persistence. Shared theme tokens style the application; specialized canvas and SVG plots may still use their own series colors. Navigation groups the main work by Home, Learn, Explore Data, Build Models and Research, with contextual links to existing workspaces.

## Verification

Run `node --test tests/full-source-workflow.test.mjs tests/csv-academy-themes.test.mjs tests/evaluation_preprocessing.test.mjs tests/prism-datasheet-f17.test.mjs`, `npm run lint`, and `npm run build:client`. New numerical tests compare streaming logistic fitting against F12, check training-only statistics under held-out mutations, check ridge accuracy and baseline means, validate exact splits and artifacts, and sort a 500,021-row source. Browser coverage in `tests/e2e/csv-academy-themes.spec.mjs` and `tests/e2e/full-source-modeling.spec.mjs` covers a 210,000-row source browser/editor, direct edited-source fitting, cancellation, protected test access, evidence export and archive persistence on desktop and mobile. These fixtures do not establish performance for every 100 MiB file.
