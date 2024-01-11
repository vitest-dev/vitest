import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    include: ['**/*.space-3-test.ts'],
    name: 'space_3',
    environment: 'node',
    globalSetup: './localSetup.ts',
  },
})
