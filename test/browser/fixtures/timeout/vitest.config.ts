import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider,
      instances: instances.map(instance => ({
        ...instance,
        context: {
          actionTimeout: 500,
        },
      })),
    },
    expect: {
      poll: {
        timeout: 500,
      },
    },
  },
})
