# NeuroForge AI 🔬

Review fixes, persistence behavior, verification commands, and current limitations are documented in [Implementation notes](docs/IMPLEMENTATION_NOTES.md).

[F20 Research Intelligence](docs/DS_F20_RESEARCH_INTELLIGENCE.md) adds saved-run comparisons and recorded cross-validation analytics with reproducible chart and research-report exports.

PRISM workspace guides: [F17 DataSheet](docs/DS_F17_PRISM_DATASHEET.md), [F18 Scientific Visualization Studio](docs/DS_F18_PRISM_VISUALIZATION.md), and [F19 Model Evaluation & Explainability](docs/DS_F19_MODEL_VISUALIZATION.md).

> **Don't just study intelligence. Build it. Train it. Understand it.**

An interactive Machine Learning & Deep Learning laboratory built with **React JSX**, **TensorFlow.js**, **HTML5 Canvas**, **Node.js/Express**, and **MongoDB**. Designed to bridge mathematical theory, empirical model experimentation, and full-stack software engineering into an interview-grade portfolio product.

---

## 🌟 The Core Workspaces

### 1. **ML Algorithm Playground (`/app/playground`)**
* **Real Mathematical Solvers:**
  * **Linear Regression:** Closed-form Ordinary Least Squares (OLS) and gradient descent, with $R^2$, MSE, and residual vectors.
  * **Logistic Regression:** Binary cross-entropy with $L_2$ regularization, live decision threshold adjustment, and a real $2 \times 2$ confusion matrix.
  * **K-Nearest Neighbors (KNN):** Non-parametric voting with Euclidean/Manhattan distance and interactive ray-casting probe.
  * **K-Means Clustering:** Step-by-step Voronoi partition updates, draggable centroids, and cluster inertia tracking.
* **Interactive 2D Canvas Toolbar:** Select/Drag points, Draw labeled points, Erase, Probe coordinates, and Pan/Zoom grid.
* **Scientific Integrity:** Mutating points marks existing decision boundaries as `Inputs changed: Boundary is stale reference`.

### 2. **Neural Network Studio (`/app/studio`)**
* **Client-Side TensorFlow.js Engine:** Real in-browser WebGL-accelerated training using Adam optimizer and binary cross-entropy.
* **Dual Visualization Modes:**
  * **Architecture Blocks:** Visual layer topology showing parameter counts, activations, and layer additions/deletions.
  * **Neuron & Weight Links:** Interactive HTML5 canvas rendering circular neurons and weighted connection lines reflecting actual learned weights ($w > 0$ cyan, $w < 0$ amber).
* **Neuron Mathematical Inspector:** Displays $z_j = \sum w_{ij} x_i + b_j \implies a_j = f(z_j)$ with live interactive coordinate sliders.
* **The XOR Non-Linearity Benchmark:** Recreates the historical Minsky & Papert perceptron failure on XOR ($50\%$ accuracy), and demonstrates how adding a single hidden layer solves it with $100\%$ convergence.

### 3. **Experiment Arena (`/app/arena`)**
* **Side-by-Side Model Benchmarking:** Compare baseline vs. variant runs on synchronized epoch timelines.
* **Synchronized Scrubber:** Scrub across training epochs to observe continuous convergence rates and generalization gaps simultaneously.
* **Automated Evidence Inspector:** Evaluates parameter efficiency, loss deltas, and automatically detects overfitting when validation error diverges.
* **Fair Comparison Protocol:** Validates that runs are evaluated on identical datasets and splits before enabling direct metric comparison.
* **Fork & Improve:** One-click duplicate of any model configuration to experiment with hyperparameter tweaks.

### 4. **Guided Technical Interview Showcase (`/showcase`)**
A curated 3-minute walkthrough demonstrating engineering depth and theoretical mastery:
1. **0:00 – 0:25:** *Arrive and Explore* — Zero-friction guest entry and client-side execution.
2. **0:25 – 1:00:** *Discover a Limitation* — Interactive XOR failure with a single-layer perceptron.
3. **1:00 – 1:45:** *Build Something Smarter* — Adding hidden representations to warp coordinate space.
4. **1:45 – 2:30:** *Investigate and Compare* — Detecting overfitting and bias-variance tradeoffs in the Arena.
5. **2:30 – 3:00:** *Reveal the Engineering* — Full-stack system architecture, tensor lifecycles, and persistence.

---

## 🛠️ Tech Stack & Design System

* **Frontend:** React 19 + JSX (Vite), Tailwind CSS, Framer Motion, Lucide Icons, Zustand
* **Client ML Engine:** `@tensorflow/tfjs` (WebGL backend)
* **Backend:** Node.js + Express.js REST API
* **Database:** MongoDB + Mongoose (with automatic in-memory fallback for offline demonstrations)
* **Design Identity:**
  * Background: `#080D18` (Deep Space)
  * Surface: `#151E30` (Obsidian)
  * Accents: `#46D7F2` (Plasma Cyan), `#A78BFA` (Neural Violet), `#3CD5AA` (Quantum Mint), `#F3B65E` (Signal Amber)
  * Fonts: Space Grotesk (Headlines), Inter (UI), JetBrains Mono (Math & Metrics)

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
# Install root, client, and server dependencies
npm install
npm --prefix client install
npm --prefix server install
```

### 2. Start the Development Servers
```bash
# Terminal 1: Start Backend API (Port 5000)
npm run dev:server

# Terminal 2: Start Frontend Client (Port 5173)
npm run dev:client
```

### 3. Open the Application
Navigate to `http://localhost:5173` in your browser.

## Verification

Run `npm run check` for numerical/storage tests, strict client lint, real MongoDB integration, and desktop/mobile Chromium smoke tests against the production build. Run `npm run test:e2e:memory` to verify the same browser journeys in temporary-memory mode, followed by `npm run baseline:summary` to collect the measured results.

Browser tests require `npx playwright install chromium`. Database tests use an installed `mongod`, `NEUROFORGE_MONGOD_BINARY`, or `NEUROFORGE_TEST_MONGODB_URI`. Every run uses isolated test data. See [Phase 0 contracts](docs/PHASE_0_CONTRACTS.md) for limits, recovery expectations, commands, and artifact locations.

Schema version 2 separates dataset versions, evaluation protocols, immutable runs and metric series while preserving existing reports. See [Phase 1 domain foundation](docs/PHASE_1_DOMAIN.md) for the draft API, compatibility behavior, and explicit backed-up migration commands. Migration does not run at startup.

The [post-review remediation notes](docs/REVIEW_REMEDIATION.md) supersede earlier roadmap-completion claims. They describe private run access, scoped sharing, account email configuration, durable recovery, synchronized drafts, model artifacts, prepared CSV datasets, diagnostics and executed sweeps. Production registration requires an authenticated email-delivery service; external delivery and deployment rollout are separate verification gates.
