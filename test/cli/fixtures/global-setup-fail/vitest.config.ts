import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')

export default defineConfig({
  test: {
    globals: true,
    globalSetup: [
      resolve(__dirname, './globalSetup/error.js'),
    ],
  },
})
