import { defineConfig, mergeConfig } from 'vitest/config'
import vitestConfig from './vitest.config'

// Patch stdin on the process so that we can fake it to seem like a real interactive terminal and pass the TTY checks
process.stdin.isTTY = true
process.stdin.setRawMode = () => process.stdin

export default mergeConfig(vitestConfig, defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    reporters: ['default'],
    globalSetup: undefined,
  },
}))
