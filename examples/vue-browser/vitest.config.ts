/// <reference types="vitest" />

import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { isCI } from 'std-env'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  test: {
    globals: true,
    browser: {
      enabled: true,
      enableUI: !isCI,
      headless: isCI,
      name: 'chrome',
      provider: process.env.BROSER_PROVIDER || 'webdriverio',
    },
  },
})
