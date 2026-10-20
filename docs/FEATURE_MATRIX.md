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

## DS-F10 advanced EDA expansion

The DS-F10 implementation adds shared dataset filters, missingness inspection, Pearson/Spearman correlation evidence, advanced quality heuristics, original-row drilldown, reproducible export and deliberate filtered-subset preparation handoff. See [DS-F10 EDA spec](DS_F10_ADVANCED_EDA.md). This DS-F10 milestone is distinct from the older release-readiness F10 designation.

## DS-F11 Visual Pipeline Studio

The next data-science milestone builds a real, ordered train-fitted graph executor and interactive editor on the existing F3 workbench. It adds numeric and categorical transforms, fitted inspection, recipe import/export and owner-scoped local saving. General prepared matrices are previewable, while old labs only accept compatible two-feature 0/1 outputs. See [DS-F11 documentation](DS_F11_PIPELINE_STUDIO.md).

## DS-F12 Generalized ML Workbench

F12 introduces a browser-local task-aware model workbench consuming every numeric output feature from F11. It includes regression/binary/multiclass tasks, N-feature baseline/logistic/ridge/kNN models, validation evidence and a one-time session-level final test gate. Full feature scope and deferrals: [DS-F12 release notes](DS_F12_MODEL_WORKBENCH.md).

## DS-F13 Explainability & Diagnostics Studio

F13 adds candidate-specific validation-only permutation importance, exact logistic/ridge local contributions, kNN neighbor-vote evidence, partial dependence and ICE, frozen-F11 source-space what-if analysis, numerical subgroup diagnostics and privacy-conscious summary export. For methods and limits see [DS-F13 documentation](DS_F13_EXPLAINABILITY_STUDIO.md).

## DS-F14 Reproducible Experiment Registry

F14 preserves F12 research receipts and F13 aggregate explanations in the owner-scoped local archive, with source/split/model/pipeline fingerprints, validation-comparable run comparisons, local final-test access audit, and opt-in verified replay of baseline/logistic/ridge fitted models. kNN remains receipt-only. See [DS-F14 documentation](DS_F14_RUN_REGISTRY.md). Full source-data restoration and cloud sync are not included.

## Important limits
- Current visual labs intentionally require two numerical feature columns; only supported binary targets and their valid stratified partitions are accepted.
- Standalone PCA and optimizer landscape tools are educational computations, not automatically applied fitted transforms or real neural model telemetry.
- A successful counterfactual search does not prove real-world causal intervention.
- A simulated input shift does not establish real production drift, fairness compliance or a privacy/security certification.
- Hosted AWS backend, credential rotation, SES mail setup, protected production releases, cloud sync and MongoDB backups remain external infrastructure work.
