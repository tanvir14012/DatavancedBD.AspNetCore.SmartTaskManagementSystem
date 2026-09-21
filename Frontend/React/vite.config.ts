import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 4200,
  },
})
