import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    browser: {
      headless: false,
    },
    include: ['test/*.test.ts'],
    poolMatchGlobs: [
      ['**/test/*.browser.test.ts', 'browser'],
      ['**/test/*.child_process.test.ts', 'child_process'],
      ['**/test/*.threads.test.ts', 'threads'],
    ],
  },
})
