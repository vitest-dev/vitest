import { defineConfig } from 'vite'
import Vue2 from '@vitejs/plugin-vue2'

export default defineConfig({
  plugins: [
    Vue2(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    alias: [{ find: /^vue$/, replacement: 'vue/dist/vue.runtime.common.js' }],
  },
})
