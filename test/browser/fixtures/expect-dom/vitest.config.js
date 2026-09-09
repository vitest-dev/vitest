import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    isolate: false,
    browser: {
      enabled: true,
      provider,
      instances,
      expect: {
        toMatchScreenshot: {
          comparators: {
            failing: () => ({ pass: false, diff: null, message: null }),
            'stability-only': (_reference, _actual, { createDiff }) => ({
              pass: !createDiff,
              diff: null,
              message: createDiff ? 'createDiff:true rejected' : null,
            }),
          },
        },
      },
    },
    setupFiles: './setup.ts',
  },
})
