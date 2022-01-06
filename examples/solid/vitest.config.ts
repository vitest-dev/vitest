/// <reference types="vitest" />

import path from 'path'
import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    threads: false,
  },
  plugins: [solidPlugin()],
  build: {
    target: 'esnext',
    polyfillDynamicImport: false,
    ssr: false,
  },
  resolve: {
    // unfortunately, this is still required, since conditions settings do not yet work
    // in the internal vite server
    alias: {
      'solid-js/web': path.resolve(__dirname, './node_modules/solid-js/web/dist/dev.js'),
      'solid-js/store': path.resolve(__dirname, './node_modules/solid-js/store/dist/dev.js'),
      'solid-js': path.resolve(__dirname, './node_modules/solid-js/dist/dev.js'),
    },
  },
})
