import { expect, test } from 'vitest'

test('toMatchInlineSnapshot', () => {
  expect.soft('--snap-1--').toMatchInlineSnapshot(`"--snap-1--"`)
  expect.soft('--snap-2--').toMatchInlineSnapshot(`"--snap-2--"`)
})

test('toThrowErrorMatchingInlineSnapshot', () => {
  expect.soft(() => { throw new Error('--error-1--') }).toThrowErrorMatchingInlineSnapshot(`[Error: --error-1--]`)
  expect.soft(() => { throw new Error('--error-2--') }).toThrowErrorMatchingInlineSnapshot(`[Error: --error-2--]`)
})
