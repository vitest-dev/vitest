import { defineConfig } from 'vite'
import marko from '@marko/vite'

export default defineConfig({
  plugins: [
    marko(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
