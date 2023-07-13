import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWorkspace } from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

export default defineWorkspace([
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
])
