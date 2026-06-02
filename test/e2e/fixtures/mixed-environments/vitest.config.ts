import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'Project #1',
          root: resolve(import.meta.dirname, './project'),
        },
      },
      {
        test: {
          name: 'Project #2',
          root: resolve(import.meta.dirname, './project'),
        },
      },
    ]
  },
})
