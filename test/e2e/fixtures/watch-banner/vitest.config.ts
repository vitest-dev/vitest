import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: [['default', { isTTY: true, summary: false }]],
  },
})
