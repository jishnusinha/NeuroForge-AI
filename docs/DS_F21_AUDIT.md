# F21 audit record

The baseline and candidate JSON and images are generated artifacts under `.artifacts/f21/`. They capture the exact built revision, route, theme, viewport, browser errors, overflow, DOM size, encoded JavaScript and local paint/navigation timing. The visual review manifest ties before/after pairs to their commit IDs. Local uncommitted source changes require retaining the diff with the artifacts; a commit ID alone does not identify those changes.

## Component inventory

| Area | Existing presentation | F21 treatment |
| --- | --- | --- |
| Application shell | Shared sidebar/header, command palette, view/theme selectors | Breadcrumbs, route focus, safe editing shortcuts and research/model destinations |
| Mission Control | Presets, showcase and saved server experiments | Three actionable research journeys, owner-scoped recent local receipts and honest runtime/split language |
| Data workflow | Import, recovery, EDA buttons, DataSheet, nested fitted pipeline and modeling | Stage navigation, population/version context and shared keyboard selectors |
| Modeling | F12/F13/F15/F19 nested scientific controls | Persistent model/split scope, consistent controls, cards and publication footer |
| Legacy labs | Dense controls, auto-height canvas, bare seed fields | Bounded desktop canvas, scrollable controls, native field styling and experiment/draft guidance |
| Research | F14 registry, F20 comparison, archived search, reports | Direct query navigation, comparison status and inspectable report preview |
| Academy/Arena | Independent headings and empty states | Shared page headers and actionable empty-state guidance |
| Universal charts | SVG/Canvas, exact tables, code and individual exports | Consistent selectors, clear reproduction scope and on-demand consent-aware ZIP |
| Feedback | Many local button/card/status variants | Shared primitives, field descriptions, zero/missing formatting and internal gallery |

## Prioritized issue register

| Priority | Baseline finding | Resolution and verification |
| --- | --- | --- |
| High | Global shortcuts could interrupt editable fields or grid cells | Editing-target guard; F21 navigation checks plus existing DataSheet keyboard suites |
| High | Query navigation remounted the active workspace | Outlet identity follows pathname; sample context survives the Model Workbench query journey |
| High | Recovery/conflict dialogs did not contain keyboard focus | Shared focus lifecycle hook; preserved explicit recovery choices and existing persistence suites |
| High | Source, working-copy, plotted and fitted populations were visually hard to distinguish | Actual count/version/scope bars in EDA, DataSheet and modeling; no invented measurements |
| Medium | Studio topology could fall below an over-tall panel | Bounded desktop grid; before/after Studio screenshots at desktop/mobile widths |
| Medium | Export files lacked a coherent package | Five-file ZIP, independent CRC checks and browser consent/download tests |
| Medium | Mission Control did not expose local research receipts | Owner-scoped recent receipt links, explicit empty/unavailable states and research deep-link flow |
| Medium | No repeatable product-wide visual review | 252 baseline + 252 candidate captures; before/after/pixel-difference review artifact |
| Medium | Duplicated presentation rules and ambiguous loading/missing feedback | Semantic token layers, components, gallery and 260-test numerical/contract gate |
| Medium | Decorative landing canvas kept rendering offscreen | Visibility/intersection lifecycle controls, reduced-motion support and cleanup |
| Release | No current field-vitals, assistive-technology or deployed F21 evidence | Explicit outstanding release checks; local tests do not certify these |
| High | A draft-status change made the lab header rewrap after paint | Reserved header columns/rows; focused checks across all seven widths reduced local lab CLS to below 0.002 |
| High | The public decorative network called random example values live/learned measurements | Explicit illustrative labels and keyboard example inspector; no fabricated accuracy claim |
| Medium | Asynchronous archive loading inserted the entire notebook after paint | Notebook layout mounts immediately with explicit loading feedback; empty local registry space is reserved |

## Measured baseline comparison

Both snapshots contain 252 images: nine routes × four themes × seven widths. Both recorded zero page errors and zero document overflow in the audited empty states. These screenshots are **not** populated-data chart or training performance measurements.

Representative Midnight/1440px local Chromium results:

| Route | Baseline LCP (ms) | Candidate LCP (ms) | Baseline CLS | Candidate CLS |
| --- | ---: | ---: | ---: | ---: |
| Landing | 340 | 480 | 0 | 0 |
| Mission Control | 620 | 732 | 0 | 0 |
| Datasets | 468 | 620 | 0 | 0 |
| Playground | 484 | 756 | 0.084 | 0.0003 |
| Research archive | 568 | 788 | 0.016 | 0 |

The candidate audit ran concurrently with browser validation and an isolated static build, so timing deltas are descriptive, not a controlled performance comparison. No speed improvement is claimed. Cache reuse also affects encoded route-resource bytes. Initial bundle size is measured independently from the production artifact: 349,049 → 357,666 bytes (about 8.4 KiB growth), below the 12 KiB allowance for shared product controls. Final CSS is 84,785 bytes. Use the generated asset record for exact bytes if a later build changes output.

The final capture recorded a maximum CLS of approximately 0.013. Its largest LCP sample was 3,092ms (Forest, 390px, Studio) under concurrent load; this does not establish that the 2.5s release target is met under a realistic profile. No field percentile or INP claim is made. Recovery interactions stop normal LCP collection, so Studio's warm-sequence LCP is omitted from the table. Separate fresh-context laboratory checks verify stable draft-feedback layout without recovery interaction.

The visual review artifact starts with every pair marked **pending**. Inspect images and document a reviewer/date/decision before promoting it to the next approved baseline. This local delivery does not silently approve all images or claim complete WCAG conformance.
