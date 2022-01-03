import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    Vue(),
  ],
  test: {
    global: true,
    isolate: false,
    environment: 'happy-dom', // jsdom fails when there are more test files
  },
})
