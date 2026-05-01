import path from 'node:path'
import { defineConfig } from 'vite'
import { defaultExclude } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['verbose'],
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
          includeTaskLocation: true,
          testTimeout: 60_000,
          isolate: false,
          fileParallelism: false,
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
            include: ['./test/reporters/configuration-options.test-d.ts'],
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
          sequence: {
            groupOrder: 1,
          },
        },
      },
    ],
  },
  server: {
    watch: {
      ignored: [
        '**/fixtures/browser-multiple/**/*',
        '**/fixtures/browser-init/**/*',
        '**/package.json',
      ],
    },
  },
})
