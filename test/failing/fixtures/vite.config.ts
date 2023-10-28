import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: false,
      },
    },
  },
})
