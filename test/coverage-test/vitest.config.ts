import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    watch: null,
  },
  test: {
    reporters: 'verbose',
    isolate: false,
    poolOptions: {
      threads: {
        // Tests may have side effects, e.g. writing files to disk,
        singleThread: true,
      },
    },
    onConsoleLog(log) {
      if (log.includes('ERROR: Coverage for')) {
        // Ignore threshold error messages
        return false
      }

      if (log.includes('Updating thresholds to configuration file.')) {
        // Ignore threshold updating messages
        return false
      }
    },
  },
})
