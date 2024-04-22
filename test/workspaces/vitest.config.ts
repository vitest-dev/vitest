import { defineConfig } from 'vitest/config'
import { cwdPlugin } from './cwdPlugin.js'

if (process.env.TEST_WATCH) {
  // Patch stdin on the process so that we can fake it to seem like a real interactive terminal and pass the TTY checks
  process.stdin.isTTY = true
  process.stdin.setRawMode = () => process.stdin
}

export default defineConfig({
  envPrefix: ['VITE_', 'CUSTOM_', 'ROOT_'],
  plugins: [cwdPlugin('ROOT')],
  test: {
    coverage: {
      enabled: true,
      provider: 'istanbul',
    },
    reporters: ['default', 'json'],
    outputFile: './results.json',
    globalSetup: './globalTest.ts',
    env: {
      CONFIG_VAR: 'root',
      CONFIG_OVERRIDE: 'root',
    },
  },
})
