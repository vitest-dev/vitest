import { defineConfig } from 'vitest/config'

// pnpm -C test/ui test-fixtures --root fixtures/seeds --run

export default defineConfig({
  test: {
    seed: 7,
  },
})
