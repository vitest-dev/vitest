import { resolve } from 'pathe'
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    includeSource: [
      'src/**/*.ts',
    ],
  },
  define: {
    'import.meta.vitest': false,
  },
  build: {
    lib: {
      formats: ['es', 'cjs'],
      entry: resolve(__dirname, 'src/index.ts'),
      fileName: 'index',
    },
  },
})
