import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
  ],
  define: {
    MY_CONSTANT: '"my constant"',
  },
  test: {
    reporters: 'verbose',
    coverage: {
      enabled: true,
      clean: true,
      all: true,
      reporter: ['html', 'text', 'lcov', 'json'],
    },
  },
})
