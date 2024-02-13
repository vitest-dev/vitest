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
        execArgv: ['--experimental-import-meta-resolve'],
      },
    },
  },
})
