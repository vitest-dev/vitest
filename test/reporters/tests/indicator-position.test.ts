import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('should print correct indicator position', async () => {
  const filename = resolve('./fixtures/indicator-position.test.js')
  const { stderr } = await runVitest({ root: './fixtures' }, [filename])
  const code = readFileSync(filename, 'utf-8')

  expect(code).toMatch(/\r\n/)
  expect(stderr).toBeTruthy()
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  indicator-position.test.js > 
    AssertionError: expected 2 to be 3 // Object.is equality

    - Expected
    + Received

    - 3
    + 2

     ❯ indicator-position.test.js:12:17
         10| 
         11| test('', async () => {
         12|   expect(1 + 1).toBe(3)
           |                 ^
         13|   expect(1 + 1).toBe(2)
         14|   expect(2 + 2).toBe(4)

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})
