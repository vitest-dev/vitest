import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: [
      './coverage-test/*.c8.test.ts',
      './coverage-test/c8/**/*test.ts',
    ],
    coverage: {
      include: ['src/**'],
      extension: ['.ts', '.vue', '.js'],
    },
  },
})
