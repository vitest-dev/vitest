import { defineConfig } from 'vite'
import ViteRuby from 'vite-plugin-ruby'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue(), ViteRuby.default()],
  test: {
    environment: 'jsdom',
  },
})
