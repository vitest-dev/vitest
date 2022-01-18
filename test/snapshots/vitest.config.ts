import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    snapshotFormat: {
      printBasicPrototype: true,
    },
  },
})
