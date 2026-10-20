# F8 — Numerical Optimizer Landscape Simulator

Neural Studio includes a self-contained educational simulator for a known convex surface, L(x,y) = ½(x² + 6y²). Users can compare actual iterative SGD, momentum and Adam coordinate updates, vary learning rate/step counts and inspect trajectories on mathematical contour ellipses.

The numeric table records every finite step, the initial and final loss, and an explicit divergence status if values exceed finite safety bounds. A stopped trajectory does not claim convergence, and a plot clipped at the view boundaries is labeled. The optimum at (0,0) is mathematically known by construction.

**Scientific distinction:** These are actual updates to a two-parameter quadratic simulator, but they are **not** a tracing of the TensorFlow.js network's weights or its reported validation loss. The component is deliberately separate from existing training and cannot change saved experiments.

Unit tests verify decrease under stable SGD, divergence under excessive learning rates, deterministic finite Momentum/Adam and invalid settings. Playwright covers desktop/mobile simulator interactions and divergence warnings in both database and local-memory modes. No AWS, credentials, saved model weights or database schema are touched.

Future F8 work: real gradient/activation paths from TensorFlow.js, filter visualizations for CNNs, and richer embedding geometries.
