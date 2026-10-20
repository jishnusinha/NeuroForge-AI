import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The public GitHub Pages build lives below /NeuroForge-AI/; local/full-stack builds stay at /.
  base: process.env.GITHUB_PAGES === 'true' ? '/NeuroForge-AI/' : '/',
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
})
