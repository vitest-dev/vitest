/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    global: true,
    environment: 'happy-dom',
  },
})
