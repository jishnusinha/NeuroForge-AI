# Phase 10 — Investigation-Based Learning and Evidence-Backed Reports

> Review correction: this historical phase note does not certify roadmap completion. See [post-review remediation](REVIEW_REMEDIATION.md) for integrated behavior, verification, and remaining deployment gates.

## Status: Implementation reviewed; production gates remain

### Overview
Phase 10 connects experimentation with education and transparent reporting. It delivers structured investigation challenges with robust property-based rubrics, and compiles verifiable scientific reports directly from recorded model runs.

---

### Key Capabilities Delivered

1. **Versioned Challenge Templates (`client/src/ml/challenges.js`)**
   - **`The Necessity of Hidden Layers`**: Requires demonstrating non-linear separation on XOR with hidden representation layers.
   - **`Learning Rate Divergence & Stability`**: Diagnoses training instability and oscillating loss with excessive learning rates vs. controlled convergence.
   - **`Validation-Based Overfitting Diagnosis`**: Identifies the inflection epoch where training loss drops while validation loss rises.
   - Structured hints, pedagogical objectives, and dataset presets.

2. **Non-Brittle Property-Based Rubrics (`gradeInvestigation`)**
   - Avoids fragile exact floating-point matches.
   - Checks underlying scientific properties: hidden layer presence, convergence criteria, loss inflection behavior, and written user hypotheses.
   - Returns a structured score (0–100) and line-item evaluation checklist.

3. **Evidence-Backed Report Generator (`client/src/ml/evidenceReport.js`)**
   - Grounded in real recorded run summaries, actual parameters, and final metric values.
   - Resolves all claims to recorded run IDs and sample IDs.
   - Distinguishes live reports from immutable frozen snapshots.
   - Excludes sensitive credentials or tokens.
   - Exports formatted Markdown documentation with comparison tables, observations, and documented threats to validity.

4. **Academy & Report Studio UI (`client/src/components/workspace/ChallengeHub.jsx`)**
   - Interactive challenge picker with objective and hints accordion.
   - Observation and limitations authoring fields.
   - Real-time rubric evaluation button with checklist pass/fail feedback.
   - One-click report compilation and Markdown file download.

---

### Verification & Test Evidence
- **Test File**: `tests/challenges_reports.test.mjs`
- **Results**:
  - `Challenge templates define reproducible investigations with objective and rubrics`: Passed
  - `Rubric grading evaluates scientific outcomes without brittle floating-point equality`: Passed
  - `Creates evidence-backed reports resolving directly to recorded run metrics`: Passed
