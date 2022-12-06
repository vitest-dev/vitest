import { defineConfig } from 'vite'
import defu from 'defu'
import { config } from './vite.config'

export default defineConfig(defu({
  base: './',
  build: {
    outDir: 'dist/report',
  },
  define: {
    __REPORT__: true,
  },
}, config))
