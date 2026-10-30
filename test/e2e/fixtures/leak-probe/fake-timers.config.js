import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./leave-fake-timers-on.js'],
  },
})
