import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { productsHandler } from './src/server/api/products'

// Serves /api/products from the same dev server so the uncached-API problem is observable.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'demo-shop-api',
      configureServer(server) {
        server.middlewares.use('/api/products', (req, res) => productsHandler(req, res))
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/products', (req, res) => productsHandler(req, res))
      },
    },
  ],
  build: { sourcemap: true },
})
