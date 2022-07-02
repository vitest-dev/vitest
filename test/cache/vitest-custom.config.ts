import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    cache: {
      dir: 'cache/.vitest-custom',
    },
  },
})
