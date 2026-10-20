# Contributing to NeuroForge AI

Thank you for improving the local-first machine-learning teaching laboratory.

## Set up the workspace
Requirements: Node.js 24, npm, and Chromium for Playwright browser verification.

```bash
npm ci
npm --prefix client ci
npm --prefix server ci
npx playwright install --with-deps chromium
npm run dev:client
```

Start the full-stack API separately with `npm run dev:server` and a local MongoDB instance if developing server-backed features. Do not commit runtime credentials, Atlas URIs or private datasets.

## Before opening a pull request
```bash
npm test
npm run lint
npm run build:client
```

The full `npm run check` also runs MongoDB integration and Playwright browser tests. Supply `NEUROFORGE_TEST_MONGODB_URI` or a local `mongod` and run `npm run test:e2e:memory` to verify no-backend guest operation. GitHub Actions runs both storage modes on Ubuntu and saves its verification summary and browser reports.

## Pull-request scope
- Work on a feature branch from current `master`; never force-push another contributor's branch.
- Keep each PR focused and include tests for mathematical invariants, malformed inputs, and at least one real desktop/mobile browser path for changed interactive controls.
- Every chart and metric must derive from measured/simulated real computation, and explicitly distinguish synthetic simulation from observed evidence.
- Keep the existing React JSX/Vite/Express/MongoDB stack and do not break the public GitHub Pages demo.
- Document changes to saved artifact schemas and keep migration/rollback instructions if schema changes are unavoidable.
- Do not make destructive or billable cloud changes in a feature PR.

## Scientific integrity
- Do not use validation or test observations to fit scalers, imputers, threshold decisions or feature transformations. An explicit exploratory EDA fit is separate from the training pipeline.
- Never fill missing measurements with invented zeros or interpolate unrecorded epochs without a visible explanatory label.
- Counterfactual predictions are model responses, not causal promises. Drift demonstrations must be labeled simulations unless they use actual permissioned production data.
- Ensure keyboard-usable controls and numerical table equivalents for data-heavy visualizations.

## Review gate
Every PR must pass `Verify NeuroForge` and receive human review. GitHub Pages deploys on merge to `master`; full-stack AWS release requires its own explicit approval and is not part of the public Pages workflow.

For security issues, follow [SECURITY.md](SECURITY.md) rather than filing public vulnerability details.
