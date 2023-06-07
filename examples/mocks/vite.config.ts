/// <reference types="vitest" />

import { resolve } from 'node:path'
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
  resolve: {
    alias: [
      { find: /^custom-lib$/, replacement: resolve(__dirname, 'projects', 'custom-lib') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    deps: {
      external: [/src\/external/],
      interopDefault: true,
      moduleDirectories: ['node_modules', 'mocks/projects'],
    },
  },
})
