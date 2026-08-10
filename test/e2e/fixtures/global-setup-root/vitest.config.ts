import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: resolve(import.meta.dirname, './nested'),
    globalSetup: './global-setup.ts',
  },
})
