import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: false,
    globalSetup: './global-setup.ts',

    // Switch between forks|threads
    pool: 'forks',

    poolOptions: {
      threads: {
        execArgv: [
          // https://nodejs.org/api/cli.html#--cpu-prof
          '--cpu-prof',
          '--cpu-prof-dir=threads-profile',

          // https://nodejs.org/api/cli.html#--heap-prof
          '--heap-prof',
          '--heap-prof-dir=threads-profile',
        ],

        // Generate a single profile
        singleThread: true,
      },

      forks: {
        execArgv: [
          // https://nodejs.org/api/cli.html#--cpu-prof
          '--cpu-prof',
          '--cpu-prof-dir=forks-profile',

          // https://nodejs.org/api/cli.html#--heap-prof
          '--heap-prof',
          '--heap-prof-dir=forks-profile',
        ],

        // Generate a single profile
        singleFork: true,
      },
    },
  },
})
