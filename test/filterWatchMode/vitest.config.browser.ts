import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'browser',
    include: ['src/client/**/*.ts', 'src/shared/**/*.ts'],
  },
})
