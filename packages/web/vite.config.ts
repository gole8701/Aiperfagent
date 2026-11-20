import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const isStatic = process.env.VITE_PERFAGENT_STATIC === '1'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: isStatic ? 'dist-static' : 'dist',
    sourcemap: false,
    // scripts/perf-budget.mjs reads it to find the entry chunk and its static imports.
    manifest: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          flow: ['@xyflow/react', 'elkjs/lib/elk-api.js'],
          markdown: ['marked', 'dompurify'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4545',
      '/ws': { target: 'ws://127.0.0.1:4545', ws: true },
      '/agent': 'http://127.0.0.1:4545',
    },
  },
})
