import { expect, test } from 'vitest'

// TODO
test.skip('not supported yet', () => {
  expect(() => expect.soft('test').toMatchInlineSnapshot()).toThrowErrorMatchingInlineSnapshot(
    `[Error: toMatchInlineSnapshot cannot be used with "soft"]`,
  )

  expect(() => expect.soft(() => {}).toThrowErrorMatchingInlineSnapshot()).toThrowErrorMatchingInlineSnapshot(
    `[Error: toThrowErrorMatchingInlineSnapshot cannot be used with "soft"]`,
  )
})
