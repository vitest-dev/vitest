/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  test: {
    environment: 'jsdom',
    pool: 'forks',
    poolOptions: {
      forks: {
        isolate: false,
      },
    },
    deps: {
      optimizer: {
        web: {
          exclude: ['solid-js'],
        },
      },
    },
  },
  plugins: [solid()],
  resolve: {
    conditions: ['development', 'browser'],
  },
})
