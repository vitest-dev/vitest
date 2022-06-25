import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue2'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
