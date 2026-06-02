import { expect, test } from 'vitest'

test('single', () => {
  for (const value of ["test1", "test2"]) {
    expect(value).toMatchInlineSnapshot()
  }
})
