import { defineConfig } from 'vite'

export default defineConfig({
  cacheDir: 'cache/.vitest-base',
  test: {
    pool: 'forks',
  },
})
