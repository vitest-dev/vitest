import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/empty-setup.test.ts'],
    setupFiles: ['setupFiles/empty-setup.ts'],
  },
})
