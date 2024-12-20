import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  optimizeDeps: {
    include: ['@vitest/cjs-lib'],
    needsInterop: ['@vitest/cjs-lib'],
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
    },
  },
})
