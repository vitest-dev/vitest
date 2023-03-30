import { defineWorkspace } from 'vitest/config'

export default defineWorkspace({
  test: {
    include: ['**/*.space-test.ts'],
    name: 'space_3',
    environment: 'node',
  },
})
