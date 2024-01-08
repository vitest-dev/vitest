import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('handle custom error without name', async () => {
  let { stdout, stderr } = await runVitest({ reporters: 'tap-flat', root: './fixtures/custom-error' })
  stdout = stdout.replaceAll(/time=(\S*)/g, 'time=[...]') // strip non-deterministic output
  expect(stdout).toMatchInlineSnapshot(`
    "TAP version 13
    1..3
    not ok 1 - basic.test.ts > no name object # time=[...]
        ---
        error:
            name: "Unknown Error"
            message: "undefined"
        ...
    not ok 2 - basic.test.ts > string # time=[...]
        ---
        error:
            name: "Unknown Error"
            message: "hi"
        ...
    not ok 3 - basic.test.ts > number # time=[...]
        ---
        error:
            name: "Unknown Error"
            message: "1234"
        ...
    "
  `)
  expect(stderr).toBe('')
})
