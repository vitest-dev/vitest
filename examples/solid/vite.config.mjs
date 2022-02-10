/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import solid from 'solid-start'

export default defineConfig({
  test: {
    environment: 'jsdom',
    transformMode: {
      web: ['.*'],
      ssr: [],
    },
  },
  plugins: [solid({ ssr: false, dev: true })],
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      'solid-js/dist/server.js': 'solid-js/dist/dev.js',
      'solid-js/web/dist/server.js': 'solid-js/web/dist/dev.js',
    },
  },
})
