import { expect, test } from 'vitest'

import { editFile, runVitest } from '../../test-utils'

test('non default snapshot format', () => {
  expect({ foo: ['bar'] }).toMatchInlineSnapshot(`
    Object {
      "foo": Array [
        "bar",
      ],
    }
  `)
})

test('--update works for workspace project', async () => {
  // setup wrong snapshot value
  editFile(
    'test/fixtures/workspace/packages/space/test/__snapshots__/basic.test.ts.snap',
    data => data.replace('`1`', '`2`'),
  )

  // run with --update
  const { stdout, exitCode } = await runVitest({
    update: true,
    root: 'test/fixtures/workspace',
    workspace: 'vitest.workspace.ts',
  })
  expect.soft(stdout).include('Snapshots  1 updated')
  expect.soft(exitCode).toBe(0)
})
