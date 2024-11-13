import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  './space_*/*.config.ts',
  {
    test: {
      name: 'space_browser_inline',
      root: './space_browser_inline',
      browser: {
        enabled: true,
        name: process.env.BROWSER || 'chromium',
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
])
