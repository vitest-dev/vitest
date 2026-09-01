import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    // load/** runs its own config (vitest.load.config.ts) with 32 parallel sessions
    include: ['stress-*.test.ts', 'zz-plain.test.ts'],
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
    },
  },
})
