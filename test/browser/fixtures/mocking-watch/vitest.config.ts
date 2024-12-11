import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  optimizeDeps: {
    include: ['@vitest/cjs-lib', '@vitest/cjs-lib/lib'],
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      fileParallelism: false,
      enabled: true,
      provider,
      instances,
      headless: true,
    },
  },
})
