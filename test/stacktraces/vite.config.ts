import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    sourcemap: 'both',
  },
  test: {
    // include: ['test/*.test.ts'],
  },
})
