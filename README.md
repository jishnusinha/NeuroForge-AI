# NeuroForge AI 🔬

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
