# F7 — Academy Learning Paths and New Scientific Checkpoints

The existing Predict-Before-Reveal Academy now groups six real, graded questions into three tracks: Model Foundations, Evaluation & Trustworthy Data, and Explainability. Additional checkpoints explicitly teach train-only preprocessing, class imbalance and the limits of counterfactual reasoning.

Answers count toward track completion **only after** selecting the scientifically correct choice. Progress is derived from the exact lesson IDs; visiting a page, revealing explanations or submitting incorrect answers does not award completion. Progress is stored in browser localStorage, scoped to the signed-in account ID when present, with the legacy guest key preserved for existing guest learning history.

Three pure unit tests validate partial/complete course progress, identity isolation and corrupt-storage fallback. Two desktop/mobile Playwright tests validate correct and incorrect answers, reload persistence, and lesson routing.

This is a local educational feature; it does not invent credentials or cloud progress, modify trained ML results, or provision AWS. ChallengeHub's evidence grading remains intact. Future expansions include longer lesson sequences, project-scoped study groups, opt-in instructor plans and cloud progress once the backend is secured.
