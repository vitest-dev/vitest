/// <reference types="vitest" />
/// <reference types="vite/client" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { isCI } from 'std-env'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react({
    fastRefresh: false,
  })],
  test: {
    globals: true,
    setupFiles: './src/test/setup.ts',
    // you might want to disable it, if you don't have tests that rely on CSS
    // since parsing CSS is slow
    css: true,
    browser: {
      enabled: true,
      enableUI: !isCI,
      headless: isCI,
      name: 'chrome',
      provider: process.env.BROSER_PROVIDER || 'webdriverio',
    },
  },
})
