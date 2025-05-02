import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'Project #1',
          root: resolve(__dirname, './project'),
        },
      },
      {
        test: {
          name: 'Project #2',
          root: resolve(__dirname, './project'),
        },
      },
    ]
  },
})
