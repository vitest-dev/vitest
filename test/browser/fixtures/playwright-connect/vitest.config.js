import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url'

export default defineConfig({
  clearScreen: false,
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
    },
  },
})
