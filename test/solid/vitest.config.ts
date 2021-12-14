/// <reference types="vitest" />

import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/Hello.test.tsx'],
  },
  plugins: [solidPlugin()],
  build: {
    target: 'esnext',
    polyfillDynamicImport: false,
    ssr: false,
  },
})
