import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
  ],
  define: {
    MY_CONSTANT: '"my constant"',
  },
  test: {
    threads: !!process.env.THREAD,
    include: [
      'test/*.test.ts',
    ],
    exclude: [
      'coverage-test/**/*',
    ],
    coverage: {
      enabled: true,
      clean: true,
      all: true,
      reporter: ['html', 'text', 'lcov', 'json'],
    },
  },
})
