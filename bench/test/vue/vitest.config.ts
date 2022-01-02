import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  resolve: {
    alias: {
      '@': resolve('.'),
    },
  },
  test: {
    global: true,
    isolate: false,
    environment: 'jsdom', // to match Jest
  },
})
