import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_PROXY_TARGET = process.env.VITE_API_PROXY ?? 'http://localhost:3000'

// For GitHub Pages deployment, set base to repo name
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isGitHubPages ? '/template-printer/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
      '/templates': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
