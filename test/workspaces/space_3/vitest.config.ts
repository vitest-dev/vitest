import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    include: ['**/*.space-test.ts'],
    name: 'space_3',
    environment: 'node',
  },
})
