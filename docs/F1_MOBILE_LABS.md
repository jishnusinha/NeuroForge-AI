# F1 — Mobile laboratories and pointer-first interaction

This change keeps ML algorithms, seeds, model saving, datasets, API, and cloud code unchanged.

- The primary navigation becomes a bottom dock at viewport widths below 1024px. The desktop rail and collapse button remain.
- Main workspace extends across the full phone width and reserves bottom padding for navigation and safe-area insets.
- Lab canvases remain usable on narrow screens; their analysis cards wrap without clipping.
- The Playground canvas uses Pointer Events rather than mouse-only event handlers, supports pointer capture for drags, larger touch targets, and redraw after ResizeObserver detects a size change.
- Toolbar tools identify their selected state through aria-pressed. Stale-result feedback moves below the floating toolbar on mobile.
- Studio's visual-mode bar wraps instead of overflowing.

Automated desktop/mobile Playwright tests verify navigation geometry, true touch taps to draw points, stale model status, and metrics layout. Full MongoDB and memory-mode suites are mandatory before merge.

Known limits: no pinch-to-zoom or full keyboard point editing yet; manual physical-device checks for iOS Safari and Android Chrome remain recommended.
