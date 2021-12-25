import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [
    svelte({ hot: !process.env.VITEST }),
  ],
  test: {
    global: true,
    environment: 'jsdom',
    deps: {
      inline: ['@testing-library/user-event'],
    },
  },
})
