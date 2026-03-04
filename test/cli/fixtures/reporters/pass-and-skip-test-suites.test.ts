import { expect, describe, test } from 'vitest'

test('passing test #1', () => {})

describe("passing suite", () => {
  test('passing test #2', () => {})
})

test.skip('skipped test #1', () => {})

describe.skip("skipped suite", () => {
  test('skipped test #2', () => {})
})