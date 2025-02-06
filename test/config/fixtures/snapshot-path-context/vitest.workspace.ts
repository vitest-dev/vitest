import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'project1',
      root: import.meta.dirname,
    }
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'project2',
      root: import.meta.dirname,
    }
  }
])
