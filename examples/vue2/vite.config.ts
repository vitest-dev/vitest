import { defineConfig } from 'vite'
import Vue2 from '@vitejs/plugin-vue2'

export default defineConfig({
  plugins: [
    Vue2(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
