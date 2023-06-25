import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { isCI } from 'std-env'

export default defineConfig({
  plugins: [
    svelte({ hot: !process.env.VITEST }),
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
