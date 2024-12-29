import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'node',
    include: ['src/server/**/*.ts', 'src/shared/**/*.ts'],
  },
})
