import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  define: {
    MY_CONSTANT: '"my constant"',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
