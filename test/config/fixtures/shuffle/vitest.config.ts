import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    sequence: {
      seed: 101,
      shuffle: true,
    }
  }
})
