import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['space-1', 'space-2'],
  },
})
