import { validateChartSpec } from '../chartSpecV2.js';

// Raw titles/headers/labels are never interpolated into executable code.
export function generatePython(spec){
  validateChartSpec(spec);
  return `# NeuroForge PRISM — plot-data reproduction, not analysis reproduction.
# Dependencies: pandas, numpy, matplotlib, seaborn.
# Keep the exported CSV and chart JSON beside this file.
# Observation-level plot data requires explicit export consent in the browser.
import json
from pathlib import Path
import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

folder = Path(__file__).resolve().parent
with (folder / "neuroforge-chart.json").open(encoding="utf-8") as stream:
    spec = json.load(stream)
assert spec["schemaVersion"] == 2
assert spec["exportManifest"]["mode"] != "metadata_only", "Export plot data with consent first"
types = {c["key"]: "string" for c in spec["evidence"]["columns"] if c["type"] == "text"}
df = pd.read_csv(folder / "neuroforge-chart-data.csv", dtype=types, keep_default_na=False)
assert len(df) == len(spec["evidence"]["rows"])
for row_index, column in spec["exportManifest"]["csvEscapes"]:
    df.at[row_index, column] = df.at[row_index, column][1:]
for column in spec["evidence"]["columns"]:
    if column["type"] == "number":
        df[column["key"]] = pd.to_numeric(df[column["key"]], errors="coerce")
# Check that the CSV really contains the exact exported evidence.
for i, saved in enumerate(spec["evidence"]["rows"]):
    for column in spec["evidence"]["columns"]:
        key = column["key"]
        value = saved.get(key)
        if value is None:
            continue
        if column["type"] == "number":
            assert np.isclose(df.at[i, key], value, rtol=1e-12, atol=1e-12)
        else:
            assert str(df.at[i, key]) == str(value)

sns.set_theme(style="whitegrid")
fig, ax = plt.subplots(figsize=(10, 5.5))
kind = spec["plot"]["kind"]
groups = list(df["series"].unique()) if "series" in df and len(df) else ["Measured evidence"]
palette = ["#42a5ad", "#d49a6a", "#9a85c7", "#62b69d", "#dfbc60", "#c9798d", "#638bc0", "#9ca873"]
if spec["visual"]["palette"] == "publication":
    palette = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#000000", "#999999"]

if kind == "heatmap":
    xs, ys = list(df["x"].unique()), list(df["y"].unique())
    values = df.pivot(index="y", columns="x", values="value").reindex(index=ys, columns=xs)
    sns.heatmap(values, mask=values.isna(), vmin=-1 if spec["plot"].get("correlation") else 0,
                vmax=spec["plot"].get("scaleMax", 1), cmap="vlag" if spec["plot"].get("correlation") else "YlGnBu",
                annot=spec["visual"]["showLabels"] and len(xs) <= 8 and len(ys) <= 12, ax=ax)
elif kind == "horizontal_error":
    ax.barh(df["x"], df["y"], color=palette[0])
    ax.errorbar(df["y"], df["x"], xerr=df["sd"], fmt="none", ecolor="gray", capsize=4)
    ax.invert_yaxis()
    ax.axvline(0, color="gray", linestyle="--")
elif kind == "waterfall":
    for i, row in df.iterrows():
        ax.bar(i, abs(row["end"]-row["start"]), bottom=min(row["start"], row["end"]),
               color=palette[0] if row["end"] >= row["start"] else palette[1])
    ax.set_xticks(range(len(df)), df["x"], rotation=30, ha="right")
elif kind == "range":
    categories = list(df["x"].unique())
    for i, name in enumerate(groups):
        part = df[df["series"] == name]
        width = .8 / max(1, len(groups))
        xx = np.array([categories.index(v) for v in part["x"]]) + (i-(len(groups)-1)/2)*width
        ax.vlines(xx, part["min"], part["max"], color=palette[i % len(palette)], label=name)
        ax.scatter(xx, part["mean"], marker="_", color=palette[i % len(palette)])
    ax.set_xticks(range(len(categories)), categories)
    ax.legend()
elif kind == "box":
    boxes = [{"label": r["series"], "whislo": r["low"], "q1": r["q1"], "med": r["median"],
              "q3": r["q3"], "whishi": r["high"], "fliers": []} for _, r in df.iterrows()]
    ax.bxp(boxes, showfliers=False)
elif kind == "violin":
    peak = max(df["y"].max(), 1e-100)
    for i, name in enumerate(groups):
        part = df[df["series"] == name]
        ax.fill_betweenx(part["x"].to_numpy(), i - .42 * part["y"].to_numpy() / peak,
                         i + .42 * part["y"].to_numpy() / peak, alpha=.4, color=palette[i % len(palette)])
    ax.set_xticks(range(len(groups)), groups)
elif kind == "lineage":
    for i, row in df.iterrows():
        ax.scatter([row["x"]], [row["y"]], s=450, color=palette[0])
        ax.annotate(row["label"], (row["x"], row["y"]), xytext=(0, -25), textcoords="offset points", ha="center")
        if i:
            ax.annotate("", xy=(row["x"], 0), xytext=(df.iloc[i-1]["x"], 0), arrowprops={"arrowstyle": "->"})
    ax.set_ylim(-1, 1)
elif kind == "matrix":
    fig.clear()
    names = spec["plot"]["facets"]
    axes = fig.subplots(len(names), len(names), squeeze=False)
    for r, yy in enumerate(names):
        for c, xx in enumerate(names):
            panel = df[(df["facet_x"] == xx) & (df["facet_y"] == yy)]
            if xx == yy:
                axes[r, c].bar(panel["x"], panel["y"], color=palette[0])
            else:
                axes[r, c].scatter(panel["x"], panel["y"], s=8, color=palette[0])
            if r == len(names)-1:
                axes[r, c].set_xlabel(xx)
            if c == 0:
                axes[r, c].set_ylabel(yy)
elif kind == "hexbin":
    image = ax.scatter(df["x"], df["y"], c=df["count"], marker="h", s=180, cmap="YlGnBu")
    fig.colorbar(image, ax=ax, label="Complete pairs per recorded hexagonal bin")
else:
    categorical = next(c for c in spec["evidence"]["columns"] if c["key"] == "x")["type"] == "text"
    categories = list(df["x"].unique()) if categorical else []
    for i, name in enumerate(groups):
        part = df[df["series"] == name] if "series" in df else df
        xx = np.array([categories.index(v) for v in part["x"]]) if categorical else part["x"].to_numpy()
        yy = part["y"].to_numpy()
        color = palette[i % len(palette)]
        if kind == "line" or (spec["plot"].get("trend") and name == "OLS fit"):
            ax.plot(xx, yy, label=name, color=color, drawstyle="steps-post" if spec["plot"].get("step") else "default")
        elif kind == "scatter":
            ax.scatter(xx, yy, label=name, color=color, s=15)
        else:
            width = .8 / max(1, len(groups))
            ax.bar(xx + (i-(len(groups)-1)/2)*width, yy, width=width, label=name, color=color)
    if categorical:
        ax.set_xticks(range(len(categories)), categories, rotation=30, ha="right")
    if len(groups) > 1:
        ax.legend()
if spec["plot"].get("reference") == "identity":
    values = pd.concat([df["x"], df["y"]]).dropna()
    if len(values):
        ax.plot([values.min(), values.max()], [values.min(), values.max()], linestyle="--", color="gray")
elif spec["plot"].get("reference") == "zero" and kind != "horizontal_error":
    ax.axhline(0, color="gray", linestyle="--")
if kind != "matrix":
    ax.set_title(spec["title"])
    ax.set_xlabel(spec["plot"].get("xLabel", ""))
    ax.set_ylabel(spec["plot"].get("yLabel", ""))
    if spec["visual"]["axisMin"] is not None:
        ax.set_ylim(bottom=spec["visual"]["axisMin"])
    if spec["visual"]["axisMax"] is not None:
        ax.set_ylim(top=spec["visual"]["axisMax"])
fig.tight_layout()
plt.show()
`;
}
