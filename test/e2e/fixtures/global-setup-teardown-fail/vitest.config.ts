import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    globalSetup: [
      resolve(import.meta.dirname, './globalSetup/error.ts'),
    ],
  },
})
