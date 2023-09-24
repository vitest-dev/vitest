import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    poolOptions: { threads: { isolate: false } },
  },
})
