import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  './space_*/*.config.ts',
  {
    test: {
      name: 'space_browser_inline',
      root: './space_browser_inline',
      browser: {
        enabled: true,
        name: process.env.BROWSER || 'chrome',
        headless: true,
        provider: process.env.PROVIDER || 'webdriverio',
      },
    },
    define: {
      TEST_DEIFNE: 'hello',
    },
  },
])
