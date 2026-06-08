import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
    pool: 'forks',
  },
})
