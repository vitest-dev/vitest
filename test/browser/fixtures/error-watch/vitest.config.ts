import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'node_modules/.vite'
  ),
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
    },
  },
})
