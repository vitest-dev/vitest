import { defineConfig } from 'vite'
import { defaultExclude } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    exclude: [...defaultExclude, '**/fixtures'],
    snapshotFormat: {
      printBasicPrototype: true,
    },
  },
})
