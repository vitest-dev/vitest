import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: 'chrome',
    open: false,
    headless: true,
  },
})
