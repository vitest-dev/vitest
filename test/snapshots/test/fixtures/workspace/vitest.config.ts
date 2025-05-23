import { defineConfig, defineWorkspace } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
