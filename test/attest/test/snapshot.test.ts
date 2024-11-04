import { attest } from '@ark/attest'
import { expect, test } from 'vitest'

test('inline', () => {
  expect(attest(1 + 2)).toMatchInlineSnapshot(`number`)
  expect(attest((1 + 2).toString)).toMatchInlineSnapshot(
    `(radix?: number | undefined) => string`,
  )
})

test('file', () => {
  expect(attest(1 + 2)).toMatchSnapshot()
  expect(attest((1 + 2).toString)).toMatchSnapshot()
})

test('mixed', () => {
  expect(1 + 2).toMatchInlineSnapshot(`3`)
  expect(1 + 2).toMatchSnapshot()
  expect(attest(1 + 2)).toMatchInlineSnapshot(`number`)
  expect(attest(1 + 2)).toMatchSnapshot()
})
