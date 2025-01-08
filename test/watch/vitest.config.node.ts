import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'node',
    include: ['fixtures/filterWorkspaces/server/**/*.ts', 'fixtures/filterWorkspaces/shared/**/*.ts'],
  },
})
