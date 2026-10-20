/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Alpha-aware CSS variables let existing Tailwind classes update instantly on theme changes.
      colors: {
        'deep-space': 'rgb(var(--nf-bg-rgb) / <alpha-value>)',
        'obsidian': 'rgb(var(--nf-surface-rgb) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--nf-elevated-rgb) / <alpha-value>)',
        'surface-dark': 'rgb(var(--nf-panel-rgb) / <alpha-value>)',
        'canvas-recessed': 'rgb(var(--nf-recessed-rgb) / <alpha-value>)',
        'surface-inset': 'rgb(var(--nf-inset-rgb) / <alpha-value>)',
        'plasma-cyan': 'rgb(var(--nf-accent-rgb) / <alpha-value>)',
        'neural-violet': 'rgb(var(--nf-secondary-rgb) / <alpha-value>)',
        'quantum-mint': 'rgb(var(--nf-mint-rgb) / <alpha-value>)',
        'signal-amber': 'rgb(var(--nf-amber-rgb) / <alpha-value>)',
        'accent-magenta': 'rgb(var(--nf-magenta-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--nf-text-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--nf-muted-rgb) / <alpha-value>)',
        'ink-on-accent': 'rgb(var(--nf-on-accent-rgb) / <alpha-value>)',
        'alert-pink': 'rgb(var(--nf-alert-pink-rgb) / <alpha-value>)',
        'alert-red': 'rgb(var(--nf-alert-red-rgb) / <alpha-value>)',
        'success-teal': 'rgb(var(--nf-teal-rgb) / <alpha-value>)',
        'accent-teal': 'rgb(var(--nf-accent-teal-rgb) / <alpha-value>)',
        'warm-amber': 'rgb(var(--nf-warm-amber-rgb) / <alpha-value>)',
        'white': 'rgb(var(--nf-white-rgb) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgb(var(--nf-accent-rgb) / 0.25)',
        'glow-violet': '0 0 25px -5px rgb(var(--nf-secondary-rgb) / 0.25)',
        'glow-mint': '0 0 25px -5px rgb(var(--nf-mint-rgb) / 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
