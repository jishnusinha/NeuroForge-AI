# F2 — Feature relationships, class balance, outliers and quality signals

The second Workbench slice adds three investigation views without changing CSV upload, preparation, model fitting, cloud sync or the GitHub Pages deployment configuration.

## What is measured
- **Relationships:** select distinct numeric X/Y features. Plot only rows with finite values for both axes. Up to 400 source observations are displayed with deterministic row-stride sampling; the plotted count and excluded incomplete-pair count are shown explicitly. A keyboard-scrollable table exposes sample values. Optionally color by a low-cardinality (2–12 distinct observed values) column, including numeric binary targets.
- **Class balance:** exact frequency table, missing-label count, percentage shares and majority/minority ratio. The 3:1 threshold is an investigation warning, not a model-performance conclusion or resampling instruction. One-class data is called out separately.
- **Outliers & quality:** original duplicate counts, missingness and constant-column review prompts, plus Tukey 1.5×IQR fences calculated on finite numeric observations. Show the exact source row/ID for the first 30 flagged values and the total flagged count. Fences are unavailable for fewer than four observed values or zero IQR.

## Data correctness and UX
Everything is computed locally and read-only from the already parsed, bounded CSV. The original preparation workflow still trains scalers/imputers **only on training data**. Workbench exploratory evidence does not fit modeling parameters and is not causal evidence. Neither outliers nor duplicate rows are automatically removed or relabeled. Tables and controls are keyboard-operable and charts have descriptive names.

## Verification and limits
Pure Node tests exercise missing pairs, constant axes, deterministic sampling, missing classes, majority ratio, IQR boundary behavior and quality signals. Desktop/mobile Playwright tests cover the sample relationship chart and a real uploaded file with 3:1 category imbalance and a single extreme observation. Existing database and local-memory browser suites must pass.

The 400-point scatter plot is deliberately a bounded visualization, not a statistically representative sampling guarantee. This phase does not include dataset correction, drag-to-select, dimensionality reduction, or full arbitrary-feature ML.
