import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    threads: false,
    cache: {
      dir: 'cache/.vitest-base',
    },
  },
})
