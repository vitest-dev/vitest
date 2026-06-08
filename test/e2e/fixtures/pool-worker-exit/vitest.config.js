import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
    pool: 'forks',
    // maxWorkers=2 (not 1) so files become SEPARATE tasks rather than being
    // batched into one. With 3 files and 2 workers, the 3rd task is
    // scheduled on a SHARED runner whose state is already STARTED — that
    // is the path where `if (!runner.isStarted)` is false and no per-task
    // error listener is registered.
    maxWorkers: 2,
    minWorkers: 2,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['json'],
      include: ['src.js'],
      reportOnFailure: true,
    },
  },
})
