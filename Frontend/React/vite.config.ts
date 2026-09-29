import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mkcert()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 4200,
    proxy: {
      '/services': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:5049',
        changeOrigin: false,
        rewrite: (url) => url.replace(/^\/services/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Tenant resolution is authority based. Keep the browser on the
            // same origin while forwarding the local tenant authority.
            if (process.env.STMS_DEV_TENANT_AUTHORITY) {
              proxyReq.setHeader('host', process.env.STMS_DEV_TENANT_AUTHORITY)
            }
          })
        },
      },
    },
  },
})
