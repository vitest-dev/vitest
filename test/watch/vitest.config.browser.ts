import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'browser',
    include: ['fixtures/filterWorkspaces/client/**/*.ts', 'fixtures/filterWorkspaces/shared/**/*.ts'],
  },
})
