import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [{
      test: {
        name: 'project-b',
        dir: 'packages/project-b',
        typecheck: {
          enabled: true,
          build: true,
        },
      },
    }],
  },
})
