import { defineConfig } from 'vitest/config'

export default defineConfig({
  clearScreen: false,
  test: {
    coverage: {
      all: true,
    },
    // include: [
    //   '**/*.spec.ts',
    //   '**/*.space-test.ts',
    // ],
    // environmentMatchGlobs: [
    //   ['**/jsdom.spec.ts', 'jsdom'],
    // ],
    workspaces: [
      './space_2/*',
      './space_*/*.config.ts',
    ],
  },
})
