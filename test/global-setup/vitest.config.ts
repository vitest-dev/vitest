/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    global: true,
    globalSetup: [
      '<rootDir>/setupFiles/default-export.js',
      '<rootDir>/setupFiles/named-exports.js',
    ],
  },
})
