# F2 — Data Science Workbench: first vertical slice

## Current functionality

Within the existing Dataset Explorer, users can import up to 2 MB / 2,000 rows / 20 columns of CSV (at least four records) or load a deterministic 120-row synthetic example. The app profiles numeric and categorical features **locally** without uploading files to a cloud service.

The profile includes:
- Row/column/missing-cell/duplicate-row counts and a descriptive column-quality table.
- Numeric min, max, mean, median, quartiles and sample standard deviation, excluding missing and nonfinite values.
- Histogram bins and categorical top categories (with an "Other categories" rollup), each accompanied by an accessible exact-count table.
- Pairwise-complete Pearson correlation matrix for up to the first eight numeric columns, with pair counts and unavailable markers for constant/insufficient data.
- Original, unmodified preview of the first 12 CSV rows; tab controls and scroll regions support keyboard interaction.

The existing `DatasetPreparation` workflow now accepts the same inspected dataset without a second upload. For supervised visual labs, the previous restrictions remain: two numeric inputs and a separate binary target, stratified train/validation/test splitting and train-only imputation/scaling. An imported CSV with only categorical columns can still be explored, but cannot be launched into the present 2D classification engine.

## Scientific interpretation
Column types are inferred using >=80% numeric observed (nonmissing) values. Descriptive statistics and histograms are computed from recorded data; missingness is not imputed for EDA. Correlation is descriptive and does not imply causal effects. Duplicate detection compares original columns, not generated row IDs. Metric calculations are independent of ML fitting and do not access held-out labels for model tuning.

## Limits and safety
This first slice deliberately does **not** implement full arbitrary-dimensional ML, categorical encoders, dataset cloud sync or data exports. CSV importer already blocks spreadsheet formula expressions; the UI renders cell contents as React text, not raw HTML. All computation is client-side and under existing file limits. Sensitive datasets should not be imported into public demos until a privacy review is complete.

## Acceptance gates
- Unit tests cover missingness, mixed types, quantiles, histograms, duplicates, correlations and unavailable data.
- Playwright desktop/mobile in database and memory modes covers real CSV file input, categorical exploration, the example and launching prepared data.
- Build/lint/integration/browser checks must pass before merge. Preserve GitHub Pages route and other labs.
