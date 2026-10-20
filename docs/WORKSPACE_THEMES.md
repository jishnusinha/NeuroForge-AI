# Workspace appearance themes

NeuroForge's Appearance selector offers **Midnight**, **Calm Slate**, **Sage Forest**, and **Soft Paper**. It is in the desktop sidebar and the mobile workspace header.

## How it works

The theme provider persists `neuroforge-theme-v1` in browser storage and sets `data-theme` on the document root. `client/index.html` reads the saved value before painting, preventing a flash of the wrong palette. Soft Paper also removes the `dark` class so Tailwind `dark:` variants respect light mode.

All application-specific Tailwind colors use RGB channel variables in `client/tailwind.config.js`, defined for each palette in `client/src/index.css`. For example, prefer `bg-deep-space`, `bg-obsidian/90`, `text-text-muted`, and `border-plasma-cyan/30` to fixed arbitrary colors. This applies to gradients and opacity variants as well.

The existing `white` Tailwind color is deliberately mapped to the **foreground/overlay** channel so `text-white` remains legible and translucent `border-white/10` remains visible on light backgrounds. For buttons on accent-colored surfaces, use `text-ink-on-accent`.

Graphics using inline SVG/canvas colors may still contain intentional visualization colors. Those should be considered separately from page chrome rather than automatically replaced.

## Verification

`tests/e2e/theme-switching.spec.mjs` tests every theme's actual rendered workspace/sidebar colors in both desktop and mobile, verifies the light-mode heading contrast, and checks reload persistence. Run it with the existing Playwright suite.
