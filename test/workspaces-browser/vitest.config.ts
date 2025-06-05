import { defineConfig } from 'vitest/config'

if (process.env.TEST_WATCH) {
  // Patch stdin on the process so that we can fake it to seem like a real interactive terminal and pass the TTY checks
  process.stdin.isTTY = true
  process.stdin.setRawMode = () => process.stdin
}

export default defineConfig({
  test: {
    reporters: ['default', 'json'],
    outputFile: './results.json',
    globalSetup: './globalTest.ts',
    projects: [
      './space_*/*.config.ts',
      {
        cacheDir: '.cache/inline',
        test: {
          name: 'space_browser_inline',
          root: './space_browser_inline',
          browser: {
            enabled: true,
            instances: [{ browser: process.env.BROWSER || 'chromium' }],
            headless: true,
            provider: process.env.PROVIDER || 'playwright',
          },
          alias: {
            'test-alias-from-vitest': new URL('./space_browser_inline/test-alias-to.ts', import.meta.url).pathname,
          },
        },
        resolve: {
          alias: {
            'test-alias-from-vite': new URL('./space_browser_inline/test-alias-to.ts', import.meta.url).pathname,
          },
        },
      },
    ],
  },
})
