import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: true,
    puppeteer: true,
    headless: true,
    open: false,
  },
})
