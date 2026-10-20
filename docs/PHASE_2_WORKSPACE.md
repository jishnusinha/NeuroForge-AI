# Phase 2 — Workspace Design System and Interaction Architecture

> Review correction: this historical phase note does not certify roadmap completion. See [post-review remediation](REVIEW_REMEDIATION.md) for integrated behavior, verification, and remaining deployment gates.

Implemented on 2026-10-18. Phase 2 delivers a unified, accessible workspace design system across NeuroForge.

## Key Capabilities Implemented

1. **Guided and Expert Views (`ViewModeToggle.jsx`, `useLabStore.js`)**:
   - Both views operate over the exact same underlying experiment configuration and hyperparameters.
   - **Guided View**: Curated controls, plain-English hints, step-by-step guidance, and simplified speed/round settings without hiding or modifying model parameters.
   - **Expert View**: Full hyperparameter controls (learning rate, optimizer selection, batch size, explicit seeds), mathematical formulas, raw metric tables, layer activation selections, and fine-grained weights/biases inspection.
   - Changing view mode is purely a presentation toggle and never mutates experiment or training state.
   - Persisted across reloads in `window.localStorage` (`'neuroforge_view_mode'`).

2. **Unified Scientific Chart System (`UnifiedChart.jsx`)**:
   - Consistent units, axes, and legends.
   - Distinct visual channels for Train vs. Validation (solid line with circular markers `●` for training, dashed line with triangular markers `▲` for validation).
   - Class colors remain distinct from run metric colors (`#46D7F2`, `#3CD5AA`).
   - Missing measurements are represented honestly (e.g. gaps in lines, `Not measured` badges) and are never coerced to zero.
   - Interactive zoom controls (`Zoom In`, `Zoom Out`, `Reset Zoom`).
   - Accessible data-table view toggle for screen readers and keyboard users.
   - Synchronized linked cursor: hovering or scrubbing an epoch updates the global linked cursor and feeds live metric values directly into the Context Inspector.

3. **Unified Context Inspector (`ContextInspector.jsx`)**:
   - Single contextual panel that dynamically renders details for:
     - **Sample**: Stable sample ID, features $(x_1, x_2)$, split membership (train vs. validation), ground truth class, model prediction, and residual error.
     - **Layer**: Layer index, layer type, units count, activation function, input/output shape, trainable parameters count.
     - **Neuron**: Layer & neuron indices, learned bias, weight vector, pre-activation, and active output for probe input.
     - **Metric**: Metric name, epoch/step, train vs validation values, delta from previous step, units.
     - **Run**: Immutable run ID, algorithm, execution status.
   - Clear empty state explaining interaction and guidance.

4. **Focus Mode (`AppShell.jsx`, `WorkspaceHeader.jsx`)**:
   - Maximizes canvas real estate for deep visual exploration.
   - Collapses sidebar and expands canvas width.
   - Keyboard accessible via `Alt+F` (or toggle button in header).

5. **Notification History & Drawer (`NotificationDrawer.jsx`, `useLabStore.js`)**:
   - Centralized notification log bounded to 50 items.
   - Records info, success, warning, and error events with timestamps.
   - Unread badge counter on the notification bell (`Alt+N`).
   - Filter by All, Alerts, or Success, with "Mark all read" and "Clear" actions.

6. **Accessible Workspace Panel (`WorkspacePanel.jsx`)**:
   - Keyboard step resizing (+/- 24px) bounded between min (240px) and max (480px).
   - Collapse/expand toggles with proper ARIA attributes (`aria-expanded`, `aria-label`).
   - Persisted in localStorage (`'neuroforge_panel_layouts'`).

## Verification & Acceptance Gate

- `tests/workspace.test.mjs` verifies:
  - Guided and Expert views share identical configuration without data mutation.
  - Missing measurements are preserved honestly without converting nulls to zero.
  - Context Inspector handles sample, layer, neuron, metric, and run data models.
  - Notification history bounds, tracks unread status, and supports actions.
  - Panel layout step resizing adheres strictly to min and max boundaries.
- Strict linter (`oxlint --deny-warnings`) passed with 0 errors and 0 warnings.
- Client production build (`vite build`) passed.
- All 26 unit and domain tests passed.
