# F21 — PRISM product experience

F21 unifies the existing data, model, research and learning workspaces. It preserves scientific engines, held-out test gates, receipt formats, dataset versions, hash routing and the four theme palettes. This is implementation documentation; it does not certify a deployed release or WCAG compliance.

## Design system and integration

`client/src/design/tokens/` separates semantic colors, typography, spacing, surfaces and motion from the legacy stylesheet. Existing `--nf-*` values remain the palette source. Tailwind exposes the semantic tokens as well. Primary and secondary content, control boundaries and focus have independent contrast checks. Divider colors are decorative and are not substitutes for required control boundaries.

`design/components/Prism.jsx` provides buttons, cards, panels, fields, metrics, statuses, empty/loading states, tables and keyboard tabs. Missing numeric values display **Unavailable**; zero remains zero. Field hints/errors are linked to their inputs. Tabs support arrows, Home and End. Existing workbench selectors retain button roles and names for compatibility. Two densities support exploration and evidence tables. Use `PrismStatus announce` for a meaningful asynchronous change; avoid repeatedly announcing static context.

Open `/app?design=gallery` to review controls, evidence and feedback fixtures. These examples are explicitly labeled as fixtures, not experiment results. The gallery is lazy loaded and does not appear in normal Mission Control.

`design/patterns/` supplies shared page headers, evidence layouts, inspectors, toolbars, dataset stages, research journeys and laboratory context. `workspaces.css` bridges existing workspaces to those tokens. This is an incremental migration: established scientific controls remain available, including advanced settings. No duplicate analytical engine was introduced.

The shell now provides breadcrumbs, route titles and direct Research Intelligence / Model Workbench commands. Editing fields and DataSheet cells own their keyboard shortcuts. Query changes on the same route preserve the mounted workspace. Route changes focus the main region. Recovery and conflict dialogs contain keyboard focus and restore the previous connected control on close.

Dataset stages link import/recovery, analysis and fitted preprocessing. Scope bars distinguish original, filtered, selected and edited populations and display actual row counts and version context. Modeling keeps validation and final-test context visible. Laboratory context explains configuration, explicit execution and stale results. Desktop laboratory panels have bounded heights so the canvas remains usable while controls scroll.

Mission Control exposes three real research journeys and recent owner-scoped local F14 receipts. An empty or unavailable archive has explicit guidance. Receipt links open the recorded run and Research Intelligence; they do not restore observation-level prediction sessions. Research reports have an inspectable preview generated from the same validated report builder used for export. Academy and Arena share the header and empty-state language.

## Publication exports

Every universal `ScientificChart` offers a reproduction ZIP containing chart JSON, exact plotted CSV, Python, JavaScript and a README. Individual SVG/PNG and code/data exports remain available. The ZIP is generated on demand in a separate chunk, with deterministic ZIP headers and CRC checks, without a new dependency.

Observation-level evidence requires the existing explicit consent checkbox. Aggregate exports do not silently include source observations. The bundle supports **plot-data reproduction**; it does not recreate training, fitted preprocessing or the complete analysis environment. Provenance, methods, units and missingness remain in the chart specification. Existing F16 native histogram exports remain unchanged.

## Audit and review workflow

See the [component inventory, prioritized issue register and measured comparison](DS_F21_AUDIT.md) for the initial F21 audit findings.

1. Build the revision under review: `npm run build:client`.
2. Before changing presentation, run `node scripts/prism-audit-f21.mjs baseline --full` and preserve the resulting artifact with its commit identifier. Never generate a replacement baseline just to silence differences.
3. Run `npm run audit:f21` against the candidate build. It captures nine major routes, four themes and seven widths: 252 viewport screenshots. Browser errors and document overflow fail the audit.
4. With both artifact directories present, run `npm run review:f21`. Open `.artifacts/f21/review/index.html` and inspect before/after/difference images at full size. Record reviewer, date, decisions and intentional changes in the generated manifest before retaining an approved baseline.
5. Store the audit JSON, screenshots and reviewed manifest together. CI uploads `.artifacts/` for 30 days. Copy an approved artifact into the baseline directory for the next review; an absent baseline is reported as unavailable, never silently approved.

The screenshot profile uses fixed viewports, reduced motion, isolated browser storage and seeded application presets. The landing illustration now uses deterministic example parameters; the pre-F21 baseline used random decorative values. Platform font rasterization can still produce pixel noise; differences use a 16-channel tolerance and require review. Screenshots establish neither contrast compliance nor keyboard usability. Real imported and fitted workflows are covered separately by browser tests.

When a preceding audit route creates a recoverable draft, the candidate audit explicitly chooses **Start fresh** in that isolated test context and records `recoveryDismissed`. This ensures lab screenshots show the workspace. Some earlier baseline images can show recovery instead; treat those pairs as different application states during review. Recovery behavior is tested separately.

## Baseline and budgets

The pre-change baseline captured 252 screenshots with zero document overflow and zero page errors in the audited empty states. The original initial JavaScript chunk was 349,049 bytes. F21 adds shared shell controls, formatting, focus and context, while charts, chart families, the component gallery and ZIP generation remain lazy. The initial chunk budget permits at most 12 KiB growth over that baseline (361,337 bytes); unexplained growth requires investigation. Large existing TensorFlow/ECharts chunks remain an architectural limitation, not a new F21 optimization claim.

The audit records encoded route JavaScript, chunk bytes, DOM nodes, navigation time, LCP and CLS. These are local Chromium lab measurements with software rendering and no network/CPU throttling. They are not a 75th-percentile field Core Web Vitals result. Release targets remain LCP ≤2.5s, CLS ≤0.1 and representative interaction latency ≤200ms under an explicitly recorded realistic profile. Browser tests verify lazy chart loading, bounded renderer counts and disposal from the DOM; they do not prove absence of every possible heap leak.

## Curated walkthroughs

**Data to evidence:** Mission Control → Explore datasets → Try sample dataset → Inspect & visualize → DataSheet. Edit a working copy, inspect its draft state, then explicitly commit a version. Switch to Chart Studio, inspect Data and Methods, and download a reproduction ZIP. The source remains distinct from the working copy and the committed version.

**Model investigation:** Mission Control → Open model workflow → import/sample → Prepare & model. Inspect the fitted F11 pipeline, open F12, configure an algorithm and explicitly train/evaluate validation. Inspect F19 evaluation and F13 explanations. Final test evaluation remains a separate deliberate action; changing configuration invalidates previous evidence.

**Research comparison:** Save supported F12/F15 runs to F14. Mission Control → recent local receipt or Open Research Intelligence. Select compatible recorded validation runs, inspect comparability and provenance, compare measured evidence, preview/export the research report, and reproduce the chart from exported plot data. Incompatible populations remain disclosed and cannot become a fabricated ranking.

## Release evidence and limits

See the [executed local verification record](DS_F21_VERIFICATION.md) for passing gates and outstanding release checks.

Seven F21 browser suites cover component/theme states, navigation and editing shortcuts, dataset stages, chart bundles/consent, responsive and enlarged text layouts, semantic contrast/keyboard focus, and renderer lifecycle. Existing numerical, MongoDB, DataSheet recovery, pipeline leakage protection, held-out test, explanation and receipt tests remain required. A 360 CSS-pixel viewport checks reflow corresponding to 400% zoom of a 1440px viewport; physical browser zoom and assistive-technology review remain manual release checks.

CI retains Node tests, strict lint, MongoDB integration, production browser tests in database and memory modes, and execution of all generated Python chart fixtures. F21 adds the full route/theme/viewport audit. Local fixture generation is not Python execution. A release requires recording the actual CI run and published GitHub Pages commit, then following these walkthroughs on the deployed static demo. No deployment is implied by this local implementation.

CI also builds an isolated static demo in `.artifacts/f21/pages-build` with `GITHUB_PAGES=true` and `VITE_STATIC_DEMO=true`, then runs `npm run verify:pages:f21`. This checks prefixed assets, hash routing, sample charts, publication ZIP download and overflow at 390/1440px. It verifies the local production artifact; it does not verify the published website.
