import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Jsx from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [Vue(), Jsx()],
  test: {
    globals: true,
    environment: 'jsdom',
    transformMode: {
      web: [/.[tj]sx$/],
    },
  },
})
