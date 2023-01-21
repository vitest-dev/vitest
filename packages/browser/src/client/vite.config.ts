import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    watch: { ignored: ['**/**'] },
  },
  build: {
    minify: false,
    outDir: '../../dist/client',
    emptyOutDir: false,
    rollupOptions: {
      external: ['/__vitest_index__'],
    },
  },
})
