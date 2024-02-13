import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        execArgv: ['--experimental-import-meta-resolve'],
      },
      forks: {
        execArgv: ['--experimental-import-meta-resolve'],
      },
      vmThreads: {
        // vmThreads already enables this flag
        // execArgv: ['--experimental-import-meta-resolve'],
      },
    },
  },
})
