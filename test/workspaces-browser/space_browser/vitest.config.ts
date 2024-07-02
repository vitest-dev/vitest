import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    browser: {
      enabled: true,
      name: process.env.BROWSER || 'chrome',
      headless: true,
      provider: process.env.PROVIDER || 'webdriverio',
    },
  },
})
