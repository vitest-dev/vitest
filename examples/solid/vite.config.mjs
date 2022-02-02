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
  },
})
