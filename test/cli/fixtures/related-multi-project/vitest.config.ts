import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'project-jsdom',
          environment: 'jsdom',
          include: ['./tests/jsdom.test.ts'],
        },
      },
      {
        test: {
          name: 'project-node',
          environment: 'node',
          include: ['./tests/node.test.ts', './tests/unrelated.test.ts'],
        },
      },
    ],
  },
})
