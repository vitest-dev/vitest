import type { TestCase } from 'vitest/node'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(import.meta.dirname, '../fixtures/skip-note')

test.for([
  { reporter: 'default', isTTY: true },
  { reporter: 'verbose', isTTY: false },
])('can leave a note when skipping in the $reporter reporter', async ({ reporter, isTTY }) => {
  const { ctx, stdout, stderr } = await runVitest({
    root,
    reporters: [
      [reporter, { isTTY }],
    ],
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('my skipped test [custom message]')

  expect(ctx).toBeDefined()
  const testTask = ctx!.state.getFiles()[0].tasks[0]
  const test = ctx!.state.getReportedEntity(testTask) as TestCase
  const result = test.result()
  expect(result).toEqual({
    state: 'skipped',
    note: 'custom message',
  })
})
