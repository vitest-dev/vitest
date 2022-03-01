/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    globalSetup: [
      './globalSetup/error.js',
    ],
  },
})
