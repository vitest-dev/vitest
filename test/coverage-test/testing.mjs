import { startVitest } from 'vitest/node'

// Set this to true when intentionally updating the snapshots
const UPDATE_SNAPSHOTS = false

const provider = getArgument('--provider')

const configs = [
  // Run test cases. Generates coverage report.
  ['test/', {
    include: ['test/*.test.ts'],
    exclude: ['coverage-report-tests/**/*'],
  }],

  // Run tests for checking coverage report contents.
  ['coverage-report-tests', {
    include: [
      './coverage-report-tests/generic.report.test.ts',
      `./coverage-report-tests/${provider}.report.test.ts`,
    ],
    coverage: { enabled: false, clean: false },
  }],
]

runTests()

async function runTests() {
  for (const threads of [true, false]) {
    for (const [directory, config] of configs) {
      await startVitest('test', [directory], {
        run: true,
        update: UPDATE_SNAPSHOTS,
        ...config,
        threads,
        coverage: {
          include: ['src/**'],
          provider,
          ...config.coverage,
        },
      })

      if (process.exitCode)
        process.exit()
    }
  }

  process.exit(0)
}

function getArgument(name) {
  const args = process.argv
  const index = args.indexOf(name)

  if (index === -1)
    throw new Error(`Missing argument ${name}, received ${args}`)

  const value = args[index + 1]

  if (!value)
    throw new Error(`Missing value of ${name}, received ${args}`)

  return value
}
