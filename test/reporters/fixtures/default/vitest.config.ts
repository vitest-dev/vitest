import { defineConfig } from 'vitest/config'

process.stdin.isTTY = true
process.stdin.setRawMode = () => process.stdin

export default defineConfig({
  test: {
    reporters: './MockReporter',
  },
})
