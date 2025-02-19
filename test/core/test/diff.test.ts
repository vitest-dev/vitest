import type { DiffOptions } from '@vitest/utils/diff'
import { stripVTControlCharacters } from 'node:util'
import { processError } from '@vitest/runner'
import { diff, diffStringsUnified, printDiffOrStringify } from '@vitest/utils/diff'
import { expect, test } from 'vitest'

function wrapDiff(diff?: string) {
  return diff && stripVTControlCharacters(`\n${diff}\n`)
}

test('displays string diff', () => {
  const stringA = 'Hello AWorld'
  const stringB = 'Hello BWorld'
  expect(wrapDiff(printDiffOrStringify(stringA, stringB))).toMatchInlineSnapshot(`
    "
    Expected: "Hello BWorld"
    Received: "Hello AWorld"
    "
  `)
})

test('displays object diff', () => {
  const objectA = { a: 1, b: 2 }
  const objectB = { a: 1, b: 3 }
  expect(wrapDiff(diff(objectA, objectB))).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

      {
        "a": 1,
    -   "b": 2,
    +   "b": 3,
      }
    "
  `)
})

test('display truncated object diff', () => {
  const objectA = { a: 1, b: 2, c: 3, d: 4, e: 5 }
  const objectB = { a: 1, b: 3, c: 4, d: 5, e: 6 }
  expect(wrapDiff(diff(objectA, objectB, { truncateThreshold: 4 }))).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

      {
        "a": 1,
    -   "b": 2,
    -   "c": 3,
    +   "b": 3,
    +   "c": 4,
    ... Diff result is truncated
    "
  `)
})

test('display one line string diff', () => {
  const string1 = 'string1'
  const string2 = 'string2'
  expect(wrapDiff(diff(string1, string2))).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

    - string1
    + string2
    "
  `)
})

test('display one line string diff should not be affected by truncateThreshold', () => {
  const string1 = 'string1'
  const string2 = 'string2'
  expect(wrapDiff(diff(string1, string2, { truncateThreshold: 3 }))).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

    - string1
    + string2
    "
  `)
})

test('display multiline string diff', () => {
  const string1 = 'string1\nstring2\nstring3'
  const string2 = 'string2\nstring2\nstring1'
  expect(wrapDiff(diff(string1, string2))).toMatchInlineSnapshot(`
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

test('display truncated multiline string diff', () => {
  const string1 = 'string1\nstring2\nstring3'
  const string2 = 'string2\nstring2\nstring1'
  expect(wrapDiff(diff(string1, string2, { truncateThreshold: 2 }))).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

    - string1
    + string2
      string2
    ... Diff result is truncated
    "
  `)
})

test('display truncated multiple items array diff', () => {
  const array1 = Array.from({ length: 45000 }).fill('foo')
  const array2 = Array.from({ length: 45000 }).fill('bar')
  expect(wrapDiff(diff(array1, array2, { truncateThreshold: 3 }))).toMatchInlineSnapshot(`
    "
    - Expected
    + Received

      [
    -   "foo",
    -   "foo",
    +   "bar",
    +   "bar",
    ... Diff result is truncated
    "
  `)
})

test('asymmetric matcher in object', () => {
  expect(stripVTControlCharacters(getErrorDiff({ x: 0, y: 'foo' }, { x: 1, y: expect.anything() }))).toMatchInlineSnapshot(`
    "- Expected
    + Received

      {
    -   "x": 1,
    +   "x": 0,
        "y": Anything,
      }"
  `)
})

test('asymmetric matcher in object with truncated diff', () => {
  expect(
    stripVTControlCharacters(getErrorDiff(
      { w: 'foo', x: 0, y: 'bar', z: 'baz' },
      { w: expect.anything(), x: 1, y: expect.anything(), z: 'bar' },
      { truncateThreshold: 3 },
    )),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received

      {
        "w": Anything,
    -   "x": 1,
    +   "x": 0,
    ... Diff result is truncated"
  `)
})

test('asymmetric matcher in array', () => {
  expect(stripVTControlCharacters(getErrorDiff([0, 'foo'], [1, expect.anything()]))).toMatchInlineSnapshot(`
    "- Expected
    + Received

      [
    -   1,
    +   0,
        Anything,
      ]"
  `)
})

test('asymmetric matcher in array  with truncated diff', () => {
  expect(
    stripVTControlCharacters(getErrorDiff(
      [0, 'foo', 2],
      [1, expect.anything(), 3],
      { truncateThreshold: 2 },
    )),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received

      [
    -   1,
    +   0,
    ... Diff result is truncated"
  `)
})

test('asymmetric matcher in nested', () => {
  expect(
    stripVTControlCharacters(getErrorDiff(
      [{ x: 0, y: 'foo' }, [0, 'bar']],
      [{ x: 1, y: expect.anything() }, [1, expect.anything()]],
    )),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received

      [
        {
    -     "x": 1,
    +     "x": 0,
          "y": Anything,
        },
        [
    -     1,
    +     0,
          Anything,
        ],
      ]"
  `)
})

test('asymmetric matcher in nested with truncated diff', () => {
  expect(
    stripVTControlCharacters(getErrorDiff(
      [{ x: 0, y: 'foo', z: 'bar' }, [0, 'bar', 'baz']],
      [{ x: 1, y: expect.anything(), z: expect.anything() }, [1, expect.anything(), expect.anything()]],
      { truncateThreshold: 5 },
    )),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received

      [
        {
    -     "x": 1,
    +     "x": 0,
          "y": Anything,
          "z": Anything,
    ... Diff result is truncated"
  `)
})

test('diff for multi-line string compared by characters', () => {
  const string1 = `
  foo,
  bar,
  `
  const string2 = `
  FOO,
  bar,
  `
  expect(
    stripVTControlCharacters(diffStringsUnified(string1, string2)),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received


    -   foo,
    +   FOO,
        bar,
        "
  `)
})

test('truncated diff for multi-line string compared by characters', () => {
  const string1 = `
  foo,
  bar,
  baz,
  `
  const string2 = `
  FOO,
  bar,
  BAZ,
  `
  expect(
    stripVTControlCharacters(diffStringsUnified(string1, string2, { truncateThreshold: 3 })),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received


    -   foo,
    +   FOO,
        bar,
    ... Diff result is truncated"
  `)
})

test('getter only property', () => {
  const x = { normalProp: 1 }
  const y = { normalProp: 2 }
  Object.defineProperty(x, 'getOnlyProp', {
    enumerable: true,
    get: () => ({ a: 'b' }),
  })
  Object.defineProperty(y, 'getOnlyProp', {
    enumerable: true,
    get: () => ({ a: 'b' }),
  })
  expect(
    stripVTControlCharacters(getErrorDiff(x, y)),
  ).toMatchInlineSnapshot(`
    "- Expected
    + Received

      {
        "getOnlyProp": {
          "a": "b",
        },
    -   "normalProp": 2,
    +   "normalProp": 1,
      }"
  `)
})

test('truncate large diff', () => {
  const diff = getErrorDiff(Array.from({ length: 500_000 }).fill(0), 1234)
  expect(diff.length).lessThan(200_000)
  expect(diff.trim()).toMatch(/\.\.\.$/)
})

function getErrorDiff(actual: unknown, expected: unknown, options?: DiffOptions): string {
  try {
    expect(actual).toEqual(expected)
  }
  catch (e) {
    const error = processError(e, options)
    return error.diff
  }
  return expect.unreachable()
}
