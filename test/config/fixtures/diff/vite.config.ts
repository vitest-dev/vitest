import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    diff: './diff.ts'
  }
})
