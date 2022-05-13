/// <reference types="vitest" />

import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'example',
      resolveId(source) {
        if (source === 'virtual-module')
          return source
      },
      load(id) {
        if (id === 'virtual-module') {
          return `
            export const value = 'original';
          `
        }
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    deps: {
      external: [/src\/external\.mjs/],
    },
  },
})
