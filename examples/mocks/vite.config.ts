/// <reference types="vitest" />

import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    global: true,
    environment: 'node',
    deps: {
      external: [/src\/external\.mjs/],
    },
  },
})
