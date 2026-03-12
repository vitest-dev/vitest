import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

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
