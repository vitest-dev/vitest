/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import solid from 'solid-start' // or use 'vite-plugin-solid' instead

export default defineConfig({
  test: {
    environment: 'jsdom',
    transformMode: {
      web: [/.[jt]sx?/],
    },
    deps: {
      inline: [/solid-js/],
    },
    threads: false,
    isolate: false,
  },
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
})
