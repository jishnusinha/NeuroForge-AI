/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'deep-space': '#080D18',
        'obsidian': '#151E30',
        'surface-elevated': '#202B43',
        'surface-dark': '#0D1422',
        'plasma-cyan': '#46D7F2',
        'neural-violet': '#A78BFA',
        'quantum-mint': '#3CD5AA',
        'signal-amber': '#F3B65E',
        'accent-magenta': '#E58FC7',
        'text-primary': '#F2F5FC',
        'text-muted': '#9EACC4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(70, 215, 242, 0.25)',
        'glow-violet': '0 0 25px -5px rgba(167, 139, 250, 0.25)',
        'glow-mint': '0 0 25px -5px rgba(60, 213, 170, 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
