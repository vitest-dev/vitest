import { defineConfig } from 'vitest/config'

// These tests assert the console-color behaviour of the default (forks) pool.
// The test-utils harness defaults spawned runs to threads, so pin forks here.
export default defineConfig({
  test: {
    pool: 'forks',
  },
})
