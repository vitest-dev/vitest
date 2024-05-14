/// <reference types="vitest" />

import { defineConfig } from 'vite'
import marko from '@marko/vite'

export default defineConfig({
  plugins: [
    marko(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
