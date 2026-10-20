# NeuroForge competitive survey and utility roadmap (October 2026)

This is a representative, feature-oriented survey rather than a claim to list every ML website. References below are official public product pages or project documentation.

## Positioning

**NeuroForge: the local-first, open-source ML learning and investigation laboratory.**

Differentiate on the complete loop:
Question → Explore data → Configure/train → Inspect errors → Test counterfactuals → Compare evidence → Explain/share reproducibly.

## Relevant tools and the behaviors to learn from

| Reference | Useful product behaviors | NeuroForge decision |
| --- | --- | --- |
| TensorFlow Playground — https://playground.tensorflow.org/ | Editable neurons, features, activation, regularization, real-time train/test loss | Extend Studio training playback and regularization explanations |
| Teachable Machine — https://teachablemachine.withgoogle.com/ | Gather/Train/Test/Export with camera, audio, pose | Later opt-in browser media training demo; never upload camera samples by default |
| GAN Lab — https://poloclub.github.io/ganlab/ | Training slow-motion, manual step, custom distributions | Add algorithm-specific playback and stepping |
| CNN Explainer — https://poloclub.github.io/cnn-explainer/ | Inspect filters, activation maps, CNN operations | Later small local CNN filter inspector |
| Transformer Explainer — https://github.com/poloclub/transformer-explainer | Interactive architecture explanations | Later attention/small-transformer educational module |
| TensorFlow Embedding Projector — https://projector.tensorflow.org/ | PCA, t-SNE, UMAP, neighbors, search, projections | Add dimensionality reduction + search with bounded data |
| What-If Tool — https://github.com/PAIR-code/what-if-tool | Edit examples, rerun predictions, examine slices/counterfactuals | High-priority counterfactual and slice-inspection UX |
| Orange — https://orangedatamining.com/ | Connectable data and ML widgets, templates | Pipeline editor with data lineage, valid tensor/task shapes |
| KNIME — https://www.knime.com/knime-analytics-platform/ | Data prep, reusable workflows, exploratory charts | Versioned, inspectable preprocessing pipeline |
| MLflow — https://mlflow.org/docs/latest/ml/tracking/ | Runs search/filter, tracking, artifact comparisons | Searchable run table and reproducibility receipts |
| W&B — https://wandb.ai/site/ | Sweeps, reports, artifacts, comparative tables | Upgrade the Arena and research-notebook report |
| Optuna — https://github.com/optuna/optuna | Hyperparameter search history, parameter importance | Parallel coordinate/contour/sweep analysis |
| Evidently — https://www.evidentlyai.com/evidently-oss | Data quality, drift, testable data checks | Data QA and drift simulator, not fake production monitoring |
| Dataiku — https://www.dataiku.com/product/machine-learning | Feature effects and model what-if explanations | Local feature importance where mathematically valid |
| PyGWalker — https://github.com/Kanaries/pygwalker | Drag-and-drop exploration, faceting and charts | EDA workbench with histograms, scatter matrices and missingness |
| H2O Flow — https://docs.h2o.ai/h2o/latest-stable/h2o-docs/flow.html | Reproducible executable narrative | Shareable research story with real captured evidence |
| Hugging Face Spaces — https://huggingface.co/spaces | Discoverable interactive demos | Guided public showcase and curated examples |
| Gradio — https://www.gradio.app/docs | Predict-on-input simplicity | Model-specific inference panels and examples |
| Fairlearn — https://fairlearn.org/main/user_guide/assessment/index.html | By-group evaluation and error rates | Opt-in slice analysis; avoid treating metrics as proof of fairness |

## Actual master-branch findings

- Implemented: React app routes, rich landing page, workspace shell, custom Canvas plot/editor, OLS/GD, logistic, KNN, K-means, TensorFlow.js sequential networks, train/validation metrics, experiments, model artifacts, Academy, Showcase.
- Implemented: IndexedDB drafts/recovery, run persistence via Express/MongoDB, ownership/sharing, anti-leakage CSV preprocessing, error explorer, neural diagnostics, sweep manager, evidence reports and automated tests.
- Not established from inspected code: general EDA dashboard, visual data pipeline composer, counterfactual search, 2D/3D embedding exploration, image/audio live training, drift sandbox, systematic accessibility audit, hosted full-stack deployment.
- Caution: `docs/REVIEW_REMEDIATION.md` reports local test passes, but external email, security, deployment verification and hosted CI are release gates. Do not relabel these as completed.

## Highest-value feature epics

### P0: Publish and harden
- Reliable public GitHub Pages **browser-only** demo; include honest local-only banner.
- Confirm CI success, telemetry-free error reporting, no leaked secrets, HTTPS and page load on mobile.
- Fix UX bugs and accessibility; add keyboard canvas alternative and chart data tables.

### P1: Data Science Workbench
- EDA: feature distributions, missingness, outliers, target imbalance, correlation/mutual information when valid, drag/drop plots, dataset snapshot comparison.
- Visual preprocessing: select columns → impute → scale → split → train → evaluate. Enforce **fit on training data only** and immutable provenance.
- Pass: importing a small CSV produces reproducible EDA and a valid leakage-free pipeline; no unsupported data format is silently coerced.

### P1: What-If / Counterfactual Explorer
- Select a sample, edit feasible input features, recompute model prediction, show changes and nearest training examples, compare original vs edited result.
- Make clear counterfactuals are model responses, **not causal guarantees**.
- Pass: numeric changes produce true inference using saved weights; missing models/unknown feature ranges are handled safely.

### P1: Research notebook and improved Arena
- Search and filter runs by metrics, datasets and parameters; compare time, size, validation curves, confusion matrices; annotate results.
- Add report sections with captured plot state, reproducibility metadata, markdown notes and static export.
- Pass: one experiment can be forked, investigated, annotated, saved, reopened and compared without losing fingerprints.

### P2: Deep Learning Visualization Pack
- Optimizer loss landscape; gradients/activation distribution; dead neurons; CNN kernel operation visualizer; embedding projector using browser-safe resource limits.
- Pass: every numerical result is calculated or clearly presented as explanatory illustration, never mixed together.

### P2: Monitoring and ethical evaluation lab
- Simulate bounded train-vs-live drift, distribution shifts, bad labels and slice-level error disparities using uploaded or synthetic example sets.
- Label simulations as such; do not imply data were observed from real production traffic.

## UX product rules
- One consistent inspector for datasets, samples, neurons, metrics and experiments.
- Guided and Expert modes share the exact same scientific state.
- Surface source/split/seed/metric and "stale" status, always.
- Distinguish train/validation/test; reserve the test set for final evaluation.
- Offer keyboard operation, accessible plots/data tables, reduced motion and bounded tasks.
- Guest-first local-first. Never require login to run educational examples.
- Do not chase every reference feature at the expense of core utility.
