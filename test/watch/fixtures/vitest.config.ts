import { defaultExclude, defineConfig } from 'vitest/config'

// Patch stdin on the process so that we can fake it to seem like a real interactive terminal and pass the TTY checks
process.stdin.isTTY = true
process.stdin.setRawMode = () => process.stdin

export default defineConfig({
  test: {
    watch: true,
    exclude: [
      ...defaultExclude,
      '**/single-failed/**',
    ],

    // This configuration is edited by tests
    reporters: 'verbose',

    forceRerunTriggers: [
      '**/force-watch/**',
    ],

    globalSetup: process.env.TEST_GLOBAL_SETUP
      ? './global-setup.ts'
      : undefined,
  },
})
