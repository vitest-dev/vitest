import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      './vitest1.config.js',
      './vitest2.config.js',
    ],
  }
})