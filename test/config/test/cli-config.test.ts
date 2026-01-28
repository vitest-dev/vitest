import { resolve } from 'pathe'
import { expect, it, test } from 'vitest'
import { createVitest } from 'vitest/node'

import { runVitest } from '../../test-utils'

test('can pass down the config as a module', async () => {
  const vitest = await createVitest('test', {
    config: '@test/test-dep-config',
  })

  expect(vitest.vite.config.configFile).toBe(
    resolve(import.meta.dirname, '../deps/test-dep-config/index.js'),
  )
})

it('correctly inherit from the cli', async () => {
  const { ctx } = await runVitest({
    $cliOptions: {
      root: 'fixtures/workspace-flags',
      logHeapUsage: true,
      allowOnly: true,
      sequence: {
        seed: 123,
      },
      testTimeout: 5321,
      pool: 'forks',
      globals: true,
      expandSnapshotDiff: true,
      retry: 6,
      testNamePattern: 'math',
      passWithNoTests: true,
      bail: 100,
      experimental: {
        importDurations: {
          print: true,
        },
      },
    },
  })
  const project = ctx!.projects[0]
  const config = project.config
  expect(config).toMatchObject({
    logHeapUsage: true,
    allowOnly: true,
    sequence: expect.objectContaining({
      seed: 123,
    }),
    testTimeout: 5321,
    pool: 'forks',
    globals: true,
    expandSnapshotDiff: true,
    retry: 6,
    passWithNoTests: true,
    bail: 100,
    experimental: {
      importDurations: {
        print: true,
        limit: 10,
      },
    },
  })
  expect(config.testNamePattern?.test('math')).toBe(true)
})
