import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['test/*.test.ts'],
    poolMatchGlobs: [
      ['**/test/*.child_process.test.ts', 'forks'],
      ['**/test/*.threads.test.ts', 'threads'],
    ],
  },
})
