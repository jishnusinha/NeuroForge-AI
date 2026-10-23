import { PRISM_CHART_DATA_FILENAME, PRISM_CHART_SPEC_FILENAME,
  validatePrismChartSpec } from './chartSpec.js';

/**
 * Summary-only CSV. All cells are finite numeric counts/bounds, so spreadsheet
 * formula injection cannot occur, even if a source dataset contains formulas.
 */
export function histogramChartCsv(spec){
  validatePrismChartSpec(spec);
  return ['bin,from,to,count',
    ...spec.bins.map(bin=>[bin.index,bin.from,bin.to,bin.count].join(',')),
  ].join('\r\n')+'\r\n';
}

/**
 * Portable Python script. Column labels, source names and chart titles are
 * READ as data from the bundled JSON, never interpolated into Python source.
  * The exported CSV contains measured histogram bins: no new histogram calculation
 * or subtly different plotting-library defaults.
 */
export function generateHistogramPython(spec){
  validatePrismChartSpec(spec);
  return `# NeuroForge PRISM — reproducible observed-value histogram
# Keep ${PRISM_CHART_DATA_FILENAME} and ${PRISM_CHART_SPEC_FILENAME} beside this script.
# Dependencies: pandas, matplotlib, seaborn
import json
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

with open("${PRISM_CHART_SPEC_FILENAME}", encoding="utf-8") as source:
    spec = json.load(source)
bins = pd.read_csv("${PRISM_CHART_DATA_FILENAME}")
assert spec["chartType"] == "histogram"
assert len(bins) == len(spec["bins"])
assert bins["count"].sum() == spec["population"]["observedCount"]
assert (bins["to"] >= bins["from"]).all()

# Use the exact recorded bin boundaries and counts.
# Constant columns use a visible one-unit bar centered on the value.
widths = (bins["to"] - bins["from"]).mask(
    (bins["to"] - bins["from"]) == 0, 1.0
)
positions = bins["from"].where(
    bins["to"] > bins["from"], bins["from"] - 0.5
)

sns.set_theme(style="whitegrid", context="notebook")
fig, ax = plt.subplots(figsize=(9, 4.8))
ax.bar(
    positions, bins["count"], width=widths, align="edge",
    color="#3F9AA8", edgecolor="#F4F7F8", linewidth=0.8
)
ax.set_title(spec["title"])
ax.set_xlabel(spec["column"])
ax.set_ylabel("Observed rows")
ax.set_ylim(bottom=0)
fig.tight_layout()
plt.show()
`;
}

export function histogramChartJson(spec){
  validatePrismChartSpec(spec);
  return JSON.stringify(spec,null,2)+'\n';
}
