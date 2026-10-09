import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    browser: {
      enabled: true,
      headless: true,
      // Firefox without the preference rejects an import map added after a module loaded
      provider: playwright({
        launchOptions: { firefoxUserPrefs: { 'dom.multiple_import_maps.enabled': false } },
      }),
      instances: [{ browser: 'firefox' }],
    },
  },
})
