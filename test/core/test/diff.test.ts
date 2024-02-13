import { expect, test, vi } from 'vitest'
import { getDefaultColors, setupColors } from '@vitest/utils'
import { diff } from '@vitest/utils/diff'
import { processError } from '@vitest/runner'
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

test('assymmetric matcher in object', () => {
  setupColors(getDefaultColors())
  expect(getErrorDiff({ x: 0, y: 'foo' }, { x: 1, y: expect.anything() })).toMatchInlineSnapshot(`
    "- Expected
    + Received

      Object {
    -   "x": 1,
    +   "x": 0,
        "y": Anything,
      }"
  `)
})

test('assymmetric matcher in array', () => {
  setupColors(getDefaultColors())
  expect(getErrorDiff([0, 'foo'], [1, expect.anything()])).toMatchInlineSnapshot(`
    "- Expected
    + Received

      Array [
    -   1,
    +   0,
        Anything,
      ]"
  `)
})

test('assymmetric matcher in nested', () => {
  setupColors(getDefaultColors())
  expect(
    getErrorDiff(
      [{ x: 0, y: 'foo' }, [0, 'bar']],
      [{ x: 1, y: expect.anything() }, [1, expect.anything()]],
    ),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received

      Array [
        Object {
    -     "x": 1,
    +     "x": 0,
          "y": Anything,
        },
        Array [
    -     1,
    +     0,
          Anything,
        ],
      ]"
  `)
})

function getErrorDiff(actual: unknown, expected: unknown) {
  try {
    expect(actual).toEqual(expected)
  }
  catch (e) {
    const error = processError(e)
    return error.diff
  }
  expect.unreachable()
}
