import path from 'node:path'
import { defineConfig } from 'vite'
import { defaultExclude } from 'vitest/config'

// Tests that drive git `--changed` against shared fixtures and cannot tolerate
// other tests mutating the working tree concurrently. Run in a serial project.
const serialTests = [
  'test/git-changed.test.ts',
  'test/list-changed.test.ts',
  'test/setup-files.test.ts',
  'test/watch/related.test.ts',
]

export default defineConfig({
  test: {
    experimental: {
      fsModuleCache: true,
    },
    reporters: [
      process.env.CI ? 'minimal' : 'verbose',
      (process.env.VITEST_CI_BLOB_LABEL
        ? ['blob', { label: process.env.VITEST_CI_BLOB_LABEL }]
        : {}),
      (process.env.VITEST_CI_MERGE_REPORTS
        ? ['html', { singleFile: true }]
        : {}),
    ],
    onConsoleLog(log) {
      if (log.includes('watcher is ready')) {
        return false
      }
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          include: ['test/**/**.{test,spec}.ts'],
          exclude: [...defaultExclude, ...serialTests],
          includeTaskLocation: true,
          testTimeout: 60_000,
          isolate: false,
          fileParallelism: true,
          maxWorkers: Number(process.env.VITEST_E2E_MAX_WORKERS) || 2,
          // TODO: should enabled when support for older node is dropped?
          // experimental: {
          //   viteModuleRunner: false,
          //   nodeLoader: false,
          // },
          chaiConfig: {
            truncateThreshold: 999,
          },
          typecheck: {
            enabled: true,
            include: [
              './test/reporters/configuration-options.test-d.ts',
              './test/benchmarking.test-d.ts',
              './test/config-types.test-d.ts',
            ],
          },
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'snapshots',
          root: path.join(import.meta.dirname, 'snapshots'),
          exclude: ['**/fixtures/**', ...defaultExclude],
          testTimeout: process.env.CI ? 20_000 : undefined,
          sequence: {
            groupOrder: 1,
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'serial',
          include: serialTests,
          includeTaskLocation: true,
          testTimeout: 60_000,
          isolate: false,
          fileParallelism: false,
          sequence: {
            groupOrder: 2,
          },
        },
      },
    ],
  },
  server: {
    watch: {
      ignored: [
        '**/vitest-test-*/**',
        '**/fixtures/browser-multiple/**/*',
        '**/fixtures/browser-init/**/*',
        '**/package.json',
      ],
    },
  },
})
