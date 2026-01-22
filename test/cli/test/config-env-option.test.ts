import { resolve } from 'node:path'
import { runVitestCli, useFS } from '#test-utils'
import { expect, test } from 'vitest'

test('passing down VITEST_FILTERS works', async () => {
  const root = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(root, {
    'basic-1.test.js': `test('basic 1', () => {})`,
    'basic-2.test.js': `test('basic 2', () => {})`,
    'vitest.config.js': {
      test: {
        globals: true,
      },
    },
  })

  const { stdout, stderr } = await runVitestCli({
    nodeOptions: {
      env: {
        VITEST_FILTERS: 'basic-1',
      },
    },
  }, `--root`, root)

  expect(stderr).toBe('')
  expect(stdout).toContain('1 passed')
  expect(stdout).toContain('basic-1')
  expect(stdout).not.toContain('basic-2')
})

test('passing down VITEST_OPTIONS overrides argv', async () => {
  const root = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)
  useFS(root, {
    'output.test.js': `test('basic 1', () => {})`,
    'vitest.config.js': `
    export default {
      test: {
        globals: true,
        reporters: [
          {
            onInit(vitest) {
              console.log(JSON.stringify(vitest.getRootProject().serializedConfig))
              throw new Error('Stopping tests')
            }
          }
        ]
      },
    }
    `,
  })

  const { stdout } = await runVitestCli({
    nodeOptions: {
      env: {
        VITEST_OPTIONS: '--logHeapUsage --allowOnly --sequence.seed 123 --testTimeout 5321 --pool forks --globals --retry 6 --passWithNoTests --bail 100',
      },
    },
  }, `--root`, root, '--testTimeout', '999', '--pool', 'vmThreads')
  const config = JSON.parse(stdout)
  expect(config).toMatchObject({
    logHeapUsage: true,
    allowOnly: true,
    sequence: {
      seed: 123,
    },
    testTimeout: 5321, // not 999
    pool: 'forks', // not vmThreads
    globals: true,
    retry: 6,
    passWithNoTests: true,
    bail: 100,
  })
})
