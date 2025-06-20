import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['test/**.test.ts'],
    includeTaskLocation: true,
    reporters: ['verbose'],
    testTimeout: 60_000,
    globals: true,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    chaiConfig: {
      truncateThreshold: 999,
    },
  },
  server: {
    watch: {
      ignored: [
        '**/fixtures/browser-multiple/**/*',
        '**/fixtures/browser-init/**/*',
      ],
    },
  },
})
