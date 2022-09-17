import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    update: false,
    benchmark: {
      outputFile: './bench.json',
      reporters: ['json'],
    },
  },
})
