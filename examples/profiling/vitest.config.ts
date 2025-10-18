import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    globalSetup: './global-setup.ts',

    // Generate a single profile
    fileParallelism: false,

    execArgv: [
      // https://nodejs.org/api/cli.html#--cpu-prof
      '--cpu-prof',
      '--cpu-prof-dir=vitest-profile',

      // https://nodejs.org/api/cli.html#--heap-prof
      '--heap-prof',
      '--heap-prof-dir=vitest-profile',
    ],
  },
})
