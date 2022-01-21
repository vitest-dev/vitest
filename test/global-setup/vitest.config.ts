/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    globalSetup: [
      './setupFiles/default-export.js',
      './setupFiles/named-exports.js',
      './setupFiles/ts-with-imports.ts',
    ],
  },
})
