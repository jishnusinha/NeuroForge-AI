# F16.0 — PRISM Scientific Chart Foundation

## First delivery in the F16–F21 visual roadmap

F16.0 introduces the **PRISM scientific editorial visual language** and one fully migrated, measured F10 chart. It is deliberately a small compatibility-first PR, not a claim that F17 spreadsheet editing or F18–F20 chart coverage already exists.

Open **Dataset Explorer → Data Science Workbench → Distributions**, select a *numeric* column, and use the new **PRISM scientific histogram**. This is a genuine rendering of the existing F10 evidence, not a sample visualization. The original F10 row filtering, the 4–16 bin control, and the active analyzed population remain authoritative.

### Features shipped

- Theme-aware premium scientific chart card: restrained typography, focus states, fine gridlines, consistent semantic accents, responsive toolbar, scroll/zoom controls and browser-native full-screen.
- Three views from one versioned chart specification:
  - **Chart:** responsive original-observation numeric histogram with actual counts and accessible bar descriptions.
  - **Data:** precise tabular bin lower/upper bounds and counts, with observed total.
  - **Python:** copyable source using Matplotlib and Seaborn to render the exact **recorded histogram bin boundaries and frequencies**, not to independently choose bins.
- Three independent downloads: `neuroforge-chart-data.csv` (summary bin counts), `neuroforge-chart.json` (chart contract, analysis population and SHA-256 digest), and `neuroforge-chart.py` (Python plotting script).
- A modified view/filter changes the chart input and therefore the exported population and scope digest. Source rows remain untouched.
- Existing categorical distributions retain a compact accessible category bar/table view. Other F10–F15 panels are unchanged.

### Run the Python chart

1. Open the **Python** view to copy the code or download its script.
2. Download **Data CSV** and **Chart JSON** from the same filtered/chart state.
3. Place all three files in the same folder.
4. Install `pandas`, `matplotlib` and `seaborn` using your chosen local Python environment.
5. Run `python neuroforge-chart.py`.

The Python script loads the histogram chart specification and its exact measured summary table, checks lengths and observed count totals, uses `sns.set_theme(...)`, and renders with `ax.bar(..., align="edge")`. For a constant column it displays a one-unit-width bar centered on the constant value. **The numerical bin counts and boundaries are reproducible; the SVG browser appearance and Matplotlib pixels need not match.**

There is **no Python execution in the web application** and no arbitrary JavaScript/Python `eval`. The script does not interpolate untrusted CSV header text into Python source; it reads labels from exported JSON at runtime.

### Privacy and scientific integrity

- `createHistogramChartSpec` delegates to F10's `distributionEvidence`, which itself relies on the existing `histogram` engine in `datasetProfiling.js`.
- The contract includes counted observed/missing values, filtered/source population counts, the requested bin count, and exact `from/to/count` bins.
- The chart JSON export asynchronously stamps a **SHA-256 chart-scope digest** over ordered filtered source values and row IDs **without including those values or identifiers in the export**.
- All files are summary-only: no original rows, row IDs, training vectors, hidden test data, or saved-model coefficients.
- Filtering scopes remain explicit. The renderer does not modify imputation, feature engineering, model training, evaluation or F14 saved receipts.
- Missing/non-finite observations are excluded; zero-observation and constant columns have explicit behavior. Charts do not imply causality.
- No new server API, database schema, cloud upload or Python backend is added.

### Architecture

| Module | Responsibility |
|---|---|
| `client/src/visualization/chartSpec.js` | Immutable-in-practice bounded, versioned numerical chart contract; F10 evidence reuse; SHA-256 chart-scope stamping |
| `client/src/visualization/pythonCodegen.js` | Aggregate CSV/JSON serialization and portable Matplotlib + Seaborn source |
| `client/src/components/workspace/charts/ScientificHistogram.jsx` | SVG scientific chart, accessible table, Python code view, zoom/fullscreen, copy/download controls |
| `client/src/index.css` | Scoped `.prism-*` chart and workspace styles respecting all pre-existing themes, mobile layouts and reduced-motion settings |
| `client/src/components/workspace/DataScienceWorkbench.jsx` | Numeric histogram migration and categorical fallback, without altering the EDA analysis population |

The contract is reusable for future charts, but F16.0 **only implements numeric histogram visualization**. Line plots, heatmaps, violin/box plots, model plots, code generation for other chart types and saved chart galleries remain future work.

### Visualization library technical decision

The F16.0 chart renderer intentionally uses **React + native SVG**, which is already deployed and needs no additional charting dependency or package-lock changes. This gives the team a production reference for visual design, chart semantics, export, keyboard/table accessibility, and measured numerical parity. During F16.1/F18 the team should benchmark Apache ECharts (Apache 2.0) against this shared `ChartSpec` for richer heatmaps, scatter interactions and large datasets, before introducing a new dependency. A native SVG first implementation is a conscious migration strategy, not a claim that ECharts has been installed.

For F17's Excel-style DataSheet, run a separate compatibility and licensing evaluation of MIT-licensed React Data Grid against the current React/Vite/Tailwind versions. **No spreadsheet engine, cell editing or workbook formulas are implemented in F16.0.**

### Tests and acceptance

- `tests/prism-chart-f16.test.mjs`: exact bin parity with F10, immutable original dataset, filtered scope, numerical export equality, SHA-256 changes, constant and empty data, validation and injection-resistant generated Python.
- `tests/e2e/prism-f16.spec.mjs`: F10 histogram, Chart/Data/Python, CSV/JSON/Python downloads, fingerprint/no raw rows, filter changes, bin controls, categorical fallback and responsive controls in desktop/mobile browsers.
- Existing F10–F15 unit, browser, accessibility, theme and memory-mode checks remain required.

Release gates: `npm run check`, `npm run test:e2e:memory`, `npm run baseline:summary`.

### Roadmap from this PR

- **F16.1:** use this reference to build an extensible multi-type `ScientificChart` API; prototype richer renderer and chart layout modes, with visual regression baselines.
- **F17:** virtualized Excel-style DataSheet, then immutable working-copy edits and undo/redo.
- **F18:** fuller F10/F11 chart gallery, including missingness/correlation, relationships, and pipeline before/after distributions.
- **F19:** F12/F13 diagnostic charts with held-out test isolation.
- **F20:** F14/F15 experiment and fold-score visual comparison, attached provenance and code exports.
- **F21:** publication layouts, annotations, performance and accessibility polish.

The first PR is valuable alone, while laying down a safe, code-generating chart contract for the remaining PRISM phases.
