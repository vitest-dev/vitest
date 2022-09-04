import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      reporters: 'json',
    },
  },
})
