import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      custom: {
        print: 'options are respected',
        array: [1, 2, 3],
      },
    },
    workspace: [
      {
        extends: true,
        test: {
          name: 'custom-pool-test',
          pool: './pool/custom-pool.ts',
          exclude: ['**/*.threads.spec.ts'],
        },
       },
      {
        extends: true,
        test: {
          name: 'threads-pool-test',
          include: ['**/*.threads.spec.ts'],
          pool: 'threads',
        },
      },
    ]
  },
})
