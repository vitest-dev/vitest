import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: [
      './coverage-test/c8/**/*test.{ts,js}',
    ],
    coverage: {
      reporter: ['html', 'text', 'lcov'],
      include: ['src/**'],
      extension: ['.ts', '.vue', '.js'],
    },
  },
})
