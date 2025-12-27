import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      './vitest.config.one.js',
      './vitest.config.two.js',
    ],
  }
})