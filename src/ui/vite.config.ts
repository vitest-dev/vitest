import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  build: {
    outDir: '../../dist/client',
  },
  optimizeDeps: {
    include: [
      'vue',
    ],
  },
})
