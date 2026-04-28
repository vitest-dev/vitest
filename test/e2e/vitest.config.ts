import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['test/**/**.{test,spec}.ts'],
    includeTaskLocation: true,
    reporters: ['verbose'],
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
    onConsoleLog(log) {
      if (log.includes('watcher is ready')) {
        return false
      }
    },
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
