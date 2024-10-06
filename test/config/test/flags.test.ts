import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('correctly inherit from the cli', async () => {
  const { ctx } = await runVitest({
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
  })
  expect(config.testNamePattern?.test('math')).toBe(true)
})
