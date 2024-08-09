import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    include: ['**/*.space-3-test.ts'],
    environment: 'node',
    globalSetup: './localSetup.ts',
    provide: {
      projectConfigValue: true,
    },
  },
})
