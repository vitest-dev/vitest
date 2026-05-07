import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['top-level-error.test.ts', 'describe-error.test.ts'],
  },
})
