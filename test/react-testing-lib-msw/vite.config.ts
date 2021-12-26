/// <reference types="vitest" />
/// <reference types="vite/client" />

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    global: true,
    environment: 'jsdom',
    deps: {
      inline: ['@testing-library/user-event'],
    },
    setupFiles: ['./src/setup.ts'],
  },
})
