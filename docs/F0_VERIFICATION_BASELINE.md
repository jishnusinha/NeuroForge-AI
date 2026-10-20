# F0 verification baseline and Pages release gate

## Observed failure (2026-10-20)
The original `Verify NeuroForge` run failed while starting MongoDB 8.0 on the GitHub-hosted runner. MongoDB 8.0 rejects Linux kernels 6.19 through 7.0.13 because of an upstream TCMalloc/rseq incompatibility (SERVER-121912). This was an infrastructure failure rather than an ML numerical test failure.

- CI now uses the supported **MongoDB 7.0** service image and checks `mongosh` health before running integration tests. This is a **temporary testing-version difference**; changing the future production database still requires compatibility testing. Review MongoDB 8 when the runner/kernel situation is resolved. See https://www.mongodb.com/docs/manual/release-notes/8.0/
- `scripts/summarize-verification.mjs` always writes a JSON summary even if earlier steps failed or a report is missing/malformed. Unavailable reports are explicitly marked and the summarizer still exits nonzero.
- Unit tests cover both complete and incomplete/malformed browser evidence.

## GitHub Pages deployment release gate
The Pages deployment workflow now runs `npm test` and `npm run lint` before deploying; it also checks that the published build has correctly prefixed JavaScript, CSS and favicon URLs. The full database + browser test suite remains in `Verify NeuroForge`.

**Limit:** These checks do not by themselves certify every interactive journey; inspect both verification workflows and perform smoke tests before treating a new release as fully validated. The deployment job is intentionally fail-closed for unit/lint/asset failures; it does not wait for the independent end-to-end verification job.

## Validation checklist
1. On the PR, confirm **Verify NeuroForge** completes MongoDB integration and Playwright browser tests for both `database` and `memory`.
2. Inspect the uploaded `.artifacts/verification-summary.json` for both storage modes.
3. Confirm unit tests, strict lint and both backend/storage browser suites pass.
4. After merging, check **Deploy NeuroForge browser demo to GitHub Pages** and open the published site.
5. Smoke-test loading, Playground regression/K-means, Studio XOR and Arena local comparisons as a guest.

**Preservation:** No AWS resources, production secrets, application ML solvers, database schemas, or main-branch application routes change in this PR.
