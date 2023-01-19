import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['**/*.dom.test.ts', 'happy-dom'],
      ['test/dom/**', 'jsdom']
    ]
  },
})
