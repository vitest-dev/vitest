import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.space-test.ts'],
    name: 'space_3',
    environment: 'node',
  },
})
