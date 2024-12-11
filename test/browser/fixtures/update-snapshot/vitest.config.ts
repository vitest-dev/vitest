import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

/*
manually test snapshot by
  pnpm -C test/browser test-fixtures --root fixtures/update-snapshot
*/

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
    },
  },
  cacheDir: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'node_modules/.vite'
  ),
})
