import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'custom-pool-test',
    pool: './pool/custom-pool.ts',
    poolOptions: {
      custom: {
        print: 'options are respected',
      },
    },
    poolMatchGlobs: [
      ['**/*.threads.spec.ts', 'threads'],
    ],
  },
})
