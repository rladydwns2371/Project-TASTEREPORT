import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  optimizeDeps:
    command === 'serve'
      ? {
          // Keeps development reliable in restricted Windows environments.
          disabled: 'dev',
          noDiscovery: true,
          include: [],
        }
      : undefined,
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}))

