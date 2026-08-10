import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    fsModuleCache: true,
    projects: [
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          pool: 'threads',
          isolate: false,
          include: ['dom.test.ts'],
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          pool: 'threads',
          isolate: false,
          include: ['node.test.ts'],
        },
      },
    ],
  },
})
