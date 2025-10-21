import { defineConfig } from 'vitest/config'
import { createCustomPool } from './pool/custom-pool'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'custom-pool-test',
          pool: createCustomPool({
            print: 'options are respected',
            array: [1, 2, 3],
          }),
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
