import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('timeout error with stack trace', async () => {
  const { stderr } = await runVitest({
    root: './fixtures/hook-timeout',
  })
  expect(stderr.replace(/ +$/gm, '')).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > beforeAll
    Error: Hook timed out in 10ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".
     ❯ basic.test.ts:4:3
          2|
          3| describe('beforeAll', () => {
          4|   beforeAll(async () => {
           |   ^
          5|     await new Promise(() => {})
          6|   }, 10)

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

     FAIL  basic.test.ts > afterAll
    Error: Hook timed out in 30ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".
     ❯ basic.test.ts:20:3
         18|
         19| describe('afterAll', () => {
         20|   afterAll(async () => {
           |   ^
         21|     await new Promise(() => {})
         22|   }, 30)

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯


    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > beforeEach > ok
    Error: Hook timed out in 20ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".
     ❯ basic.test.ts:12:3
         10|
         11| describe('beforeEach', () => {
         12|   beforeEach(async () => {
           |   ^
         13|     await new Promise(() => {})
         14|   }, 20)

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

     FAIL  basic.test.ts > afterEach > ok
    Error: Hook timed out in 40ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".
     ❯ basic.test.ts:28:3
         26|
         27| describe('afterEach', () => {
         28|   afterEach(async () => {
           |   ^
         29|     await new Promise(() => {})
         30|   }, 40)

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

    "
  `)
})
