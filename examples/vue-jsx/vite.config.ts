import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Jsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [Vue(), Jsx()],
  test: {
    global: true,
    environment: 'happy-dom',
    ssrTransformInclude: /.[tj]sx$/,
  },
})
