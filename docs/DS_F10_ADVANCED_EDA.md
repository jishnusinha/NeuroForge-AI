# DS-F10 — Advanced Data Science & EDA Laboratory

> The repository already uses "F10" for a separate historical release-readiness track. This advanced data-science implementation is called **DS-F10**.

## Delivery scope

Builds on `/app/datasets`, F2 Data Science Workbench, and the existing F3 train-only preprocessing pipeline. The existing routes, CSV limits and ML code remain in place.

Implemented in this PR:

- **Shared immutable analytical scope**: an AND-composed filter toolbar supports categorical/text comparisons, numeric ranges, missing/present conditions, clear/remove controls, and exact source/active row counts.
- **Advanced distributions**: interactive histogram-bin settings (4–16) using full eligible observations.
- **Missingness laboratory**: exact missing/observed counts per feature, complete/incomplete record counts, bounded visual missingness matrix, co-missingness calculation and original-row inspection.
- **Correlation laboratory**: Pearson and average-tie-rank Spearman, selectable numeric columns (up to twelve), sample counts, unavailable-state evidence, and source pair inspection.
- **Quality Pro**: read-only findings for exact duplicates, missingness, constant/near-constant fields, mixed observed types, high cardinality, identifier candidates and Tukey-IQR outlier candidates. Counts are descriptive heuristics, not errors or automatic correction.
- **Row Explorer**: source row IDs, stable sorting, bounded pagination and drilldown from correlation, outlier, missingness and scatter evidence.
- **Evidence**: opt-in Markdown/JSON reports with a SHA-256 source fingerprint, canonical filter definitions, scoped statistics, quality methods and user-written limitations. Raw source records are deliberately excluded.
- **Explicit subset handoff**: user may replace the current preparation input with a new copy of eligible filtered rows, provided at least four rows remain. No pipeline transforms are fitted by EDA.

## Architecture and code

| Location | Purpose |
| --- | --- |
| `client/src/ml/edaFilters.js` | Pure validation, immutable filtering and stable row sorting |
| `client/src/ml/edaMissingness.js` | Exact counts, co-missingness, bounded display sample |
| `client/src/ml/edaStatistics.js` | Rank correlations and parameterized histograms |
| `client/src/ml/edaQuality.js` | Descriptive quality findings and original-row IDs |
| `client/src/ml/edaEvidence.js` | Source checksum and safe reproducibility report |
| `client/src/components/workspace/eda/` | Accessible UI for filters, missingness, correlations, quality, rows and report export |
| `DataScienceWorkbench.jsx` | Shares one filtered analysis population across all existing and new views |
| `DatasetInvestigation.jsx` | Original-row drilldown from scatter evidence and outlier table |
| `DatasetsPage.jsx` | Explicit subset-to-preparation handoff without implicit source mutation |

## Scientific safeguards

- Filtered statistics describe **the active observed population**, not necessarily the original full dataset.
- Values displayed in a scatter plot may be sampled; analytical counts use the full bounded filtered dataset.
- Missing or invalid values are not silently imputed. Correlations require complete observed pairs and sufficient variation.
- Coefficients and outliers are descriptive evidence; no causal or data-quality guarantees are implied.
- Exported findings exclude original data rows; notes and filters may still contain user-entered text.
- A subset handed to preparation is a deliberate new dataset copy; existing train-only fitted preprocessing and 2D binary-target restrictions still apply.
- EDA analysis is in-memory for the current page session. Reports can be exported; automatic recovery of imported source rows after reload is **not** provided.

## Resource and compatibility boundaries

Import remains limited to 2 MiB, 2,000 rows and 20 columns. Displayed scatter points remain limited to 400; the missingness matrix displays at most 80 sampled records. Row Explorer shows 25 rows per page. The new correlation matrix displays a maximum of 12 numeric columns.

The browser is the computation boundary. No backend dataset endpoint, automatic cloud upload, ML algorithm modification, or new database collection is added.

## Validation

- `tests/eda-f10.test.mjs` covers filter composition and rejection, immutability, exact missingness, Spearman ties/unavailable data, distribution totals, duplicate original rows and digest-only reports.
- `tests/e2e/eda-f10.spec.mjs` exercises filtering, Spearman matrix inspection, row explorer, missingness, JSON export and explicit subset handoff.
- Run the repository's existing `npm run check`, `npm run test:e2e:memory` and `npm run baseline:summary` workflows.

## Further iterations (not claimed complete in this PR)

A linked-brush scatterplot matrix, grouped ECDF/box-plot dashboards, user-driven numerical type overrides, optional IndexedDB investigation restoration, statistical performance benchmark automation, and dedicated worker execution for data volumes beyond current limits remain follow-up projects.
