import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'custom-pool-test',
    pool: './pool/custom-pool.ts',
    poolOptions: {
      custom: {
        print: 'options are respected',
        array: [1, 2, 3],
      },
    },
    poolMatchGlobs: [
      ['**/*.threads.spec.ts', 'threads'],
    ],
  },
})
