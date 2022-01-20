import { defineConfig } from 'vite'
import ViteRuby from 'vite-plugin-ruby'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [Vue(), ViteRuby()],
  test: {
    environment: 'jsdom',
  },
})
