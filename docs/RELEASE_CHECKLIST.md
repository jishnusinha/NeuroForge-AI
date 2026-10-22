# Release checklist — browser demo and full-stack cloud

## F20 research acceptance

- Verify saved archive filters, selection limits, all six research charts and archived seven-view F15 explorer after refresh.
- Verify exact source/split/task/metric compatibility, lower-is-better RMSE, higher-is-better F1, tied leaders, contextual collections and unavailable scores.
- Verify incomplete live trials have no mean/rank and cancellation prevents promotion.
- Verify chart record selection requires the existing explicit training action; final-test access remains protected.
- Verify Markdown/JSON reports and CSV/JSON/Python/JavaScript/SVG/PNG chart exports preserve recorded evidence without observations, fitted weights or final-test scores.
- Run unit tests, strict lint, production build, MongoDB integration and desktop/mobile browser suites in database and memory modes.
- Execute the 42 generated Python plotting programs in CI. Local fixture generation alone does not certify Python rendering.
- Confirm F14/F15 workflows and F16–F19 chart behavior remain covered. Record actual CI and deployment evidence before declaring release.

## GitHub Pages (already deployed; verify each merge)
1. The PR targets `master`, the required verification workflow is green (Node tests, strict client lint, MongoDB integration, Playwright Chromium desktop/mobile in database and memory mode).
2. Numerical invariants, source/seed/split provenance, stale-result warnings, and absence of invented measurements have been reviewed.
3. The GitHub Pages workflow builds with `GITHUB_PAGES=true` and `VITE_STATIC_DEMO=true`; verify prefixed JS/CSS/favicon assets.
4. Check the actual published URL https://jishnusinha.github.io/NeuroForge-AI/ and hash route `#/app/datasets`; the site remains navigable without any backend.
5. As a guest, import a small CSV, inspect workbench figures, prepare a supported dataset, run Playground and Studio, save/reopen a local run, and compare runs in Arena.
6. Verify at mobile viewport and with a physical device when possible. Confirm keyboard access and readable chart-table fallbacks.
7. Check no `MONGODB_URI`, `AUTH_EMAIL_WEBHOOK_SECRET`, AWS credential, session token or other private configuration was embedded in the frontend. Check the actual built bundle, not only source.
8. Record the final deployed commit and Actions run in the release notes.

## Optional full-stack cloud — explicitly NOT automatically released
- Obtain explicit approval for the expected recurring AWS bill and resource creation.
- Confirm actual Free Tier/credit eligibility; create billing alerts and review quotas/region.
- Provision infrastructure with an approved, least-privilege plan; private Atlas IP allowlist (never `0.0.0.0/0`), TLS proxy, no public SSH/Express port and validated public egress IP.
- Supply secrets through a server-only store; never commit them or print them in workflow logs.
- Scope GitHub OIDC trust to exact repo/environment; confirm protected production environment and audited deployment, health checks and rollback.
- Harden authentication/session cookies, CSRF, CORS, login abuse controls and secure email-delivery sandbox/production status.
- Verify least-privilege ownership, share expiration/revocation, backup and test restore, retention limits, data deletion and incident playbook.
- Test both valid and invalid user workflows and failure modes on staging, then approve production cutover separately.
- Preserve the no-backend GitHub Pages edition during outages.

**Do not report the AWS deployment as completed** based only on this checklist. A real AWS environment, secrets, hosting and operational verification require separate authorization and evidence.

## F21 product experience gate

- Run the seven F21 browser suites in both storage modes alongside existing scientific regression suites.
- Run `npm run audit:f21`; inspect all themes and widths, then generate `npm run review:f21` using the preserved pre-change baseline. Retain the reviewed manifest with the images; do not automatically approve changed pixels.
- Check normal text contrast ≥4.5:1 and applicable focus/control boundaries ≥3:1 separately from screenshots. Complete manual screen-reader, physical zoom and touch checks before claiming accessibility compliance.
- Inspect initial-route JavaScript against the 361,337-byte F21 budget; confirm chart families and reproduction bundles stay lazy. Record the actual performance profile and representative interactions, not a field percentile inferred from local tests.
- Follow all three [F21 research walkthroughs](DS_F21_PRODUCT_EXPERIENCE.md) on the published Pages revision. Record deployment commit, CI run and any remaining limitations.

## Deferred product roadmap
A first slice for an epic is not the entire epic: further work includes arbitrary-dimensional/categorical preprocessing, multiclass and clustering algorithms, deeper neural CNN/attention/gradient visualizations, rich research notebook organization, full accessibility and performance audits, and production cloud identity/synchronization. Report these gaps explicitly rather than claiming feature completeness.

## F22.0 review gate

- Run `npm run fixtures:f22` and `python scripts/verify-learning-code-f22.py` with the documented dependencies; require CI Python execution before merge.
- Verify copy/download, live settings, unavailable model states, synthetic provenance, four themes, keyboard tabs, and mobile overflow in the Code Companion.
- Preserve existing training, F8 optimizer, F12 final-test isolation, and chart export checks. Review and manually merge F22.0 before dependent F22 phases. See [F22 documentation](DS_F22_OPTIMIZATION_CODE_LAB.md).
