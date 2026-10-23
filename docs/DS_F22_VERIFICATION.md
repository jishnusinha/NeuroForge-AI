# F22 verification record

Date: 2026-10-22–23. Source implementation spans F22.0–F22.5. External PR review, merge, deployed Pages inspection and physical-device signoff are separate activities.

| Gate | Local evidence |
| --- | --- |
| Numerical/domain tests | 278 passed, including F8 compatibility and all F10–F21 numerical contracts |
| Lint | Strict lint passes with no warnings |
| Production build | Pass; initial JS 358,519 bytes, below the existing 361,337-byte F21 gate |
| Lazy 3D | Separate approximately 523 kB raw / 131 kB gzip renderer chunk; homepage does not load it |
| Learning examples | 34 JavaScript executions and 34 Python executions passed across 17 contexts |
| Optimization parity | 16 configurations in both float64 PyTorch styles passed against JavaScript, including independent framework optimizers/autograd |
| Search examples | Seven algorithms in Python and JavaScript passed; holdout access remains false |
| Existing chart Python | All 42 chart families compiled and rendered successfully |
| New browser acceptance | 30 desktop/mobile cases passed before the full regression run; the final 20-case atlas rerun also passes, including actual canvas viewport bounds; both mesh budgets, source exports, context loss, no-WebGL fallback, camera controls, immutable replay, keyboard, themes, mobile overflow and hidden playback |
| Full browser regression | Each storage mode: 250 passed and two overnight timeouts out of 252 cases. All four timed-out cases passed focused reruns: seven memory cases and 24 database desktop/mobile cases passed, with no failures or skips. Original and rerun reports preserved under `.artifacts/f22/`; combined record: `browser-verification-summary.json` |
| Mongo integration | Passed against an isolated real MongoDB instance |
| Static Pages | Passed hash-route, code-download, real 3D initialization and actual canvas viewport-bound checks at 390px and 1440px; isolated build under `.artifacts/f22/pages-build` |

```text
GITHUB_PAGES=true VITE_STATIC_DEMO=true npm --prefix client run build -- --outDir ../.artifacts/f22/pages-build
node scripts/verify-pages-build.mjs .artifacts/f22/pages-build
node scripts/verify-learning-pages-f22.mjs
```

The static smoke checks use local preview, test hash routes and code downloads, and assert real WebGL initialization/trace projection at 390px and 1440px. This does not assert a production deployment.

Final follow-up fixed scene benchmark `initMs` to retain setup duration instead of elapsed scene age. Strict lint and production build passed afterward. The 24-case database rerun verifies the final renderer on desktop/mobile, including an assertion that exported initialization time matches the displayed measurement for both mesh sizes. The full-suite reports are retained as `full-memory-results.json` and `full-database-results.json`; focused reports are `retry-memory-results.json` and `retry-database-results.json`. These are separate runs, not a claim of one uninterrupted 504-pass run.

Playwright attaches scene benchmark JSON for 97×97 and 161×161 meshes on desktop and mobile. It records initialization time, CPU render-submission time, frame intervals, viewport/pixel ratio/reduced-motion state and heap where Chromium exposes it. Tests require a bounded geometry count, no rebuild for recoloring and a lost old context after replacement. PNG screenshots cover all four themes. GPU tests use Chromium software rendering (`--use-angle=swiftshader`); these are not mid-range physical-device FPS measurements.

Resource disposal is verified through context replacement/unmount and zero live tensors after generated TF.js examples. No claim is made that a heap sample alone proves absence of every leak. Manual screen-reader/touch-device testing, physical GPU performance targets, CI on the remote runner, review/merge and published Pages remain release signoff. The functional source and local verification do not require a backend or paid service.

Local full-suite commands use `--trace off` after an ENOSPC artifact-write failure on this workstation. Screenshots, attached benchmark JSON and all assertions remain enabled; no tests are skipped. Temporary Python runtime and abandoned task-owned database directories were removed after verification to recover disk space. CI retains its existing trace policy.
