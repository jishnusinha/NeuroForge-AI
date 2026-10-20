# NeuroForge feature and deployment boundaries

## Product surfaces
- Public browser demo: https://jishnusinha.github.io/NeuroForge-AI/
- GitHub source: https://github.com/jishnusinha/NeuroForge-AI
- Backend: optional separately deployed Express + MongoDB, **not hosted by GitHub Pages**.

## Core capabilities from the existing main branch
- Browser-local Playground with linear/logistic regression, KNN and K-means.
- TF.js Neural Studio, Arena saved-run comparisons, Academy and Showcase.
- CSV import / quality profile / distributions / correlations / preprocessing into existing 2D labs.
- Feature relationships, class balance, outlier review and evidence tables; local experimentation/persistence and data-preserving preview.
- Backend routes and MongoDB models exist in source, but public production cloud accounts/mail/remote sharing are not established by the static Pages deployment.

## Optional follow-on feature phases (check the merged branch, not a claim of release)
- F3: Visual dataset pipeline and train-only median/mean imputation and split choices.
- F4: Deterministic CART tree and exploratory two-feature PCA.
- F5: Fitted-model What-If and bounded counterfactual probing.
- F6: Research Notebook over measured saved runs and local evidence reports.
- F7: Graded Academy learning paths.
- F8: Convex optimizer landscape demonstration (distinct from actual TF.js weights).
- F9: Validation calibration, feature subgroups and hypothetical input shift.
- F10: contributor/security/release-readiness documentation.

**These phases must not be marked deployed until their independent PRs have passed CI, merged, and their Pages workflow succeeded.** This table describes roadmap identities and implementation scopes, not a live-production certification.

## Important limits
- Current visual labs intentionally require two numerical feature columns; only supported binary targets and their valid stratified partitions are accepted.
- Standalone PCA and optimizer landscape tools are educational computations, not automatically applied fitted transforms or real neural model telemetry.
- A successful counterfactual search does not prove real-world causal intervention.
- A simulated input shift does not establish real production drift, fairness compliance or a privacy/security certification.
- Hosted AWS backend, credential rotation, SES mail setup, protected production releases, cloud sync and MongoDB backups remain external infrastructure work.
