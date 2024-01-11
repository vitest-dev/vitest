import { expect, test, vi } from 'vitest'
import { getDefaultColors, setupColors } from '@vitest/utils'
import { diff } from '@vitest/utils/diff'
import { displayDiff } from '../../../packages/vitest/src/node/error'

test('displays object diff', () => {
  const objectA = { a: 1, b: 2 }
  const objectB = { a: 1, b: 3 }
  const console = { log: vi.fn(), error: vi.fn() }
  setupColors(getDefaultColors())
  displayDiff(diff(objectA, objectB), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

      Object {
        "a": 1,
    -   "b": 2,
    +   "b": 3,
      }
    "
  `)
})

test('display one line string diff', () => {
  const string1 = 'string1'
  const string2 = 'string2'
  const console = { log: vi.fn(), error: vi.fn() }
  setupColors(getDefaultColors())
  displayDiff(diff(string1, string2), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

    - string1
    + string2
    "
  `)
})

test('display multiline line string diff', () => {
  const string1 = 'string1\nstring2\nstring3'
  const string2 = 'string2\nstring2\nstring1'
  const console = { log: vi.fn(), error: vi.fn() }
  setupColors(getDefaultColors())
  displayDiff(diff(string1, string2), console as any)
  expect(console.error.mock.calls[0][0]).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

    - string1
      string2
    - string3
    + string2
    + string1
    "
  `)
})
