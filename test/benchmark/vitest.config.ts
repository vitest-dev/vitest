import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    update: false,
    allowOnly: true,
    benchmark: {
      outputFile: './bench.json',
      reporters: ['json'],
    },
  },
})
