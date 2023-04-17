import { startVitest } from 'vitest/node'

// Set this to true when intentionally updating the snapshots
const UPDATE_SNAPSHOTS = false

const provider = process.argv[1 + process.argv.indexOf('--provider')]
const isBrowser = process.argv.includes('--browser')

const configs = [
  // Run test cases. Generates coverage report.
  ['test/', {
    include: ['test/*.test.*'],
    exclude: [
      'coverage-report-tests/**/*',
      // TODO: Include once mocking is supported in browser
      isBrowser && '**/no-esbuild-transform.test.js',
    ].filter(Boolean),
    coverage: { enabled: true },
    browser: { enabled: isBrowser, name: 'chrome', headless: true },
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

// Prevent the "vitest/src/node/browser/webdriver.ts" from calling process.exit
const exit = process.exit
process.exit = () => !isBrowser && exit()

for (const threads of [{ threads: true }, { threads: false }, { singleThread: true }]) {
  for (const isolate of [true, false]) {
    for (const [directory, config] of configs) {
      await startVitest('test', [directory], {
        name: `With settings: ${JSON.stringify({ ...threads, isolate, directory, browser: config.browser?.enabled })}`,
        ...config,
        update: UPDATE_SNAPSHOTS,
        ...threads,
        isolate,
      })

      if (process.exitCode) {
        console.error(`process.exitCode was set to ${process.exitCode}, exiting.`)
        exit()
      }
    }
  }
}

exit()
