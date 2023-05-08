import { expect, test, vi } from 'vitest'
import { getDefaultColors, setupColors } from '@vitest/utils'
import { displayDiff } from 'vitest/src/node/error'
import { unifiedDiff } from '@vitest/utils/diff'

test('displays object diff', () => {
  const objectA = { a: 1, b: 2 }
  const objectB = { a: 1, b: 3 }
  const console = { log: vi.fn(), error: vi.fn() }
  setupColors(getDefaultColors())
  displayDiff(unifiedDiff(objectA, objectB), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "  - Expected  - 1
      + Received  + 1

        {
          a: 1,
      -   b: 2,
      +   b: 3,
        }"
  `)
})

test('display one line string diff', () => {
  const string1 = 'string1'
  const string2 = 'string2'
  const console = { log: vi.fn(), error: vi.fn() }
  setupColors(getDefaultColors())
  displayDiff(unifiedDiff(string1, string2), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "  - Expected  - 1
      + Received  + 1

      - 'string1'
      + 'string2'"
  `)
})

test('display multiline line string diff', () => {
  const string1 = 'string1\nstring2\nstring3'
  const string2 = 'string2\nstring2\nstring1'
  const console = { log: vi.fn(), error: vi.fn() }
  setupColors(getDefaultColors())
  displayDiff(unifiedDiff(string1, string2), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "  - Expected  - 1
      + Received  + 2

      - \`string1
        string2
      - string3\`
      + \`string2"
  `)
})
