import { startVitest } from 'vitest/node'

// Set this to true when intentionally updating the snapshots
const UPDATE_SNAPSHOTS = false

const provider = process.argv[1 + process.argv.indexOf('--provider')]
const isBrowser = process.argv.includes('--browser')
const isCI = process.env.GITHUB_ACTIONS
process.env.COVERAGE_PROVIDER = provider

// TODO: Fix flakiness and enable on CI -- browser picks test files that don't exist and fails, some tests fail because of the multi environment mismatch
if (isCI)
  process.exit(0)

const poolConfigs = [
  { pool: 'threads', poolOptions: { threads: { } } },
  { pool: 'forks', poolOptions: { forks: { } } },
  { pool: 'threads', poolOptions: { threads: { singleThread: true } } },

  // TODO: Figure out what's wrong with vmThreads and coverage test "runDynamicFileCJS". This issue is likely present in main branch too.
  // { pool: 'vmThreads', poolOptions: { vmThreads: { } } },
]

// Threads have no effect in browser mode
if (isBrowser)
  poolConfigs.splice(1)

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

    // Regression vitest#3330
    reporters: ['default', 'junit'],
    outputFile: { junit: 'coverage/junit.xml' },
  }],

  // Run tests for checking coverage report contents.
  ['coverage-report-tests', {
    include: [
      ['v8', 'istanbul'].includes(provider) && './coverage-report-tests/generic.report.test.ts',
      `./coverage-report-tests/${provider}.report.test.ts`,
    ].filter(Boolean),
    coverage: { enabled: false, clean: false },
  }],
]

// Prevent the "vitest/src/node/browser/webdriver.ts" from calling process.exit
const exit = process.exit
process.exit = () => !isBrowser && exit()

for (const { pool, poolOptions } of poolConfigs) {
  for (const isolate of [true, false]) {
    for (const [directory, config] of configs) {
      // Retry flaky browser tests
      const retries = Array(config.browser?.enabled ? 3 : 1).fill(0)

      for (const retry of retries.keys()) {
        const poolConfig = {
          pool,
          poolOptions: {
            [pool]: {
              ...poolOptions[pool],
              isolate,
            },
          },
        }

        await startVitest('test', [directory], {
          name: `With settings: ${JSON.stringify({ ...poolConfig, directory, browser: config.browser?.enabled })}`,
          ...config,
          update: UPDATE_SNAPSHOTS,
          ...poolConfig,
        })

        if (process.exitCode && retry === retries.length - 1) {
          console.error(`process.exitCode was set to ${process.exitCode}, exiting.`)
          exit()
        }
        else if (process.exitCode) {
          process.exitCode = null
          console.warn(`Browser tests failed, retrying ${1 + retry}/${retries.length - 1}...`)
        }
        else {
          break
        }
      }
    }
  }
}

exit()
