import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['./test/coverage-report/**/*.test.(js|ts)'],
    coverage: {
      include: ['src/**'],
      extension: ['.ts', '.vue', '.js'],
    },
  },
})
