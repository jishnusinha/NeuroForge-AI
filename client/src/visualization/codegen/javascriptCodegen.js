import {validateChartSpec} from '../chartSpecV2.js';
export function generateJavaScript(spec){
  validateChartSpec(spec);
  return `// NeuroForge PRISM: exact plot-data reproduction, never a preprocessing refit.
// Use a bundler with Apache ECharts installed, serve alongside the exported JSON,
// and provide <div id="chart" style="width:100%;height:550px"></div>.
import * as echarts from "echarts";
const spec = await fetch("./neuroforge-chart.json").then(response => {
  if (!response.ok) throw new Error("Chart JSON could not be loaded");
  return response.json();
});
if (spec.schemaVersion !== 2 || !spec.renderOption || spec.exportManifest.mode === "metadata_only") {
  throw new Error("Export the exact plot data, with observation consent when required");
}
const chart = echarts.init(document.getElementById("chart"), null, { renderer: "svg" });
chart.setOption(spec.renderOption);
const observer = new ResizeObserver(() => chart.resize());
observer.observe(document.getElementById("chart"));
// On component teardown: observer.disconnect(); chart.dispose();
// All coordinates, bins, counts and fitted summaries come from recorded evidence.
// Raw header strings are treated as JSON data, never executable JavaScript.
`;
}
