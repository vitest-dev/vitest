/// <reference types="vitest" />
import { sveltekit } from '@sveltejs/kit/experimental/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    global: true,
    environment: 'jsdom',
  },
})
