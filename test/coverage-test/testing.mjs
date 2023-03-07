import { startVitest } from 'vitest/node'

// Set this to true when intentionally updating the snapshots
const UPDATE_SNAPSHOTS = false

const provider = process.argv[1 + process.argv.indexOf('--provider')]

const configs = [
  // Run test cases. Generates coverage report.
  ['test/', {
    include: ['test/*.test.*'],
    exclude: ['coverage-report-tests/**/*'],
    coverage: { enabled: true },
  }],

  // Run tests for checking coverage report contents.
  ['coverage-report-tests', {
    include: [
      ['c8', 'istanbul'].includes(provider) && './coverage-report-tests/generic.report.test.ts',
      `./coverage-report-tests/${provider}.report.test.ts`,
    ].filter(Boolean),
    coverage: { enabled: false, clean: false },
  }],
]

for (const threads of [{ threads: true }, { threads: false }, { singleThread: true }]) {
  for (const isolate of [true, false]) {
    for (const [directory, config] of configs) {
      await startVitest('test', [directory], {
        name: `With settings: ${JSON.stringify({ ...threads, isolate, directory })}`,
        ...config,
        update: UPDATE_SNAPSHOTS,
        ...threads,
        isolate,
      })

      if (process.exitCode)
        process.exit()
    }
  }
}
