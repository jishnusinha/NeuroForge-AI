# F1 — Accessible navigation and command palette

First vertical slice of the Premium UX 2.0 workstream. No ML, persistence or backend behavior changes.

## UX changes
- Search results now use keyboard-operable choices with clear selection semantics and visible focus indicators.
- Search input exposes the active result via `aria-activedescendant`, and a live region announces the matching-command count and selected option.
- The command dialog traps Tab/Shift+Tab while open; Escape and clicking the backdrop dismiss it. Focus returns to the original launcher.
- Dialog sizing and shortcut footer fit narrow mobile screens, with scrolling for long lists.
- Main workspaces have an accessible **Skip to main content** control that uses programmatic focus instead of changing URL fragments (important for HashRouter on GitHub Pages).
- Sidebar toggle controls have explicit accessible labels and expanded state; global keyboard focus treatment is consistent.

## Manual and automated verification
- Playwright desktop + mobile: launcher → search → empty state → focus wrap → Escape restoration → select route, skip control, backdrop dismissal.
- Existing Playground/Studio/Arena keyboard shortcuts and business logic must continue working.
- On GitHub Pages, verify hash routes and the skip control don't conflict; no need to create backend accounts.
- Existing CI must pass before merge. This slice is not a full WCAG compliance audit.

## Follow-on F1 slices
- Responsive lab panels and touch-friendly dataset controls.
- Chart keyboard access and readable data-table alternatives where needed.
- Mobile navigation shortcuts and persisted workspace preferences.
- Contrast and screen-reader audit across Academy, Experiment Arena and account dialogs.
