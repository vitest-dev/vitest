import path from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('fixture parsing works for lowered async syntax', async () => {
  const { stdout } = await runVitest({
    root: path.resolve('fixtures/fixture-no-async'),
    reporters: ['tap-flat'],
  })
  expect(stdout.replaceAll(/\s*# time=.*/g, '')).toMatchInlineSnapshot(`
    "TAP version 13
    1..6
    ok 1 - basic.test.ts > test sync
    ok 2 - basic.test.ts > test async
    ok 3 - basic.test.ts > test.for sync 1
    ok 4 - basic.test.ts > test.for sync 2
    ok 5 - basic.test.ts > test.for async 1
    ok 6 - basic.test.ts > test.for async 2
    "
  `)
})
