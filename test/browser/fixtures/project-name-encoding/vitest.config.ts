import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'Components & Hooks',
    browser: {
      enabled: true,
      headless: true,
    },
  },
})
