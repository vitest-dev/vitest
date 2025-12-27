import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      isolate: false,
      expect: {
        toMatchScreenshot: {
          comparators: {
            failing: () => ({ pass: false, diff: null, message: null }),
          },
        },
      },
    },
    setupFiles: './setup.ts',
  },
})
