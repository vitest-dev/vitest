import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    pool: 'forks',
    cache: {
      dir: 'cache/.vitest-base',
    },
  },
})
