import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiOrigin = process.env.API_PROXY_TARGET || 'http://localhost:9090'

const proxy = {
  '/api': {
    target: apiOrigin,
    changeOrigin: true,
  },
  '/auth': {
    target: apiOrigin,
    changeOrigin: true,
  },
  '/ws': {
    target: apiOrigin,
    changeOrigin: true,
    ws: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
})
