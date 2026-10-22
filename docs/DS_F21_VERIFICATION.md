# F21 local verification record

Verified locally on Windows with Chromium software rendering and Node 24. These results describe the working tree, not a published release. Scientific engines in `client/src/ml/`, shared data contracts and server code have no F21 changes.

| Gate | Result |
| --- | --- |
| Complete Node suite | 260 passed |
| Strict client lint | Passed |
| Production build | Passed |
| Real MongoDB integration | Passed |
| Full desktop/mobile browser suites | 210 passed in database mode; 210 passed in temporary-memory mode |
| Final F21, F14, F20 and notebook checks after presentation refinements | 50 passed in each storage mode |
| Final route/theme/viewport audit | 252 captures; zero document overflow; zero page errors |
| Visual review package | 252 before/after/difference comparisons generated; human sign-off pending |
| Isolated static Pages build | Asset paths, hash routing, sample chart and reproduction ZIP passed at 390/1440px |
| Python chart fixtures | Generated; local Python execution unavailable |

The full suites ran before the last presentation refinements. A further 86-case UI run exercised laboratory training, DataSheet editing/recovery and accessibility; 82 passed in each storage mode, and it exposed the stage-focus mistake and an incorrect observer-count assumption in a new test. Those were corrected. The final 50-case runs are green and include the corrected CSV/pipeline focus and renderer lifecycle checks, all new F21 suites, receipt compatibility, archive comparisons and research notebooks. No failed case is left unresolved.

Full browser reports are preserved under `.artifacts/f21/verification/{database-full,memory-full}/`; final focused results are under `.artifacts/e2e-{database,memory}/`. Audit JSON, build fingerprint, screenshots and review manifest are under `.artifacts/f21/`. Initial JavaScript is 357,666 bytes against the 361,337-byte budget. See the [audit record](DS_F21_AUDIT.md) for paint/layout measurements and their limits.

MongoDB initially could not start because the system temporary drive was full. Integration and database browser checks passed with `TEMP` and `TMP` directed to `.artifacts/f21/tmp` in the workspace. Every test database remained isolated and was cleaned by the existing test helper.

The machine has no installed Python runtime (`py --list-paths` confirms this). The existing CI job executes the generated plotting programs with pinned plotting dependencies; that job has not been triggered or certified by this local work. No GitHub deployment was performed.

Release verification still requires the actual CI/Python result, manual assistive-technology and physical zoom/touch checks, reviewed visual baseline approval, realistic-profile/field performance evidence, and verification of the published Pages revision. WCAG compliance and field Core Web Vitals are not certified by these local checks.
