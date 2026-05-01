import { expect, test } from 'vitest'

test('single', () => {
  for (const value of ["test1", "test1"]) {
    expect(value).toMatchInlineSnapshot(`"test1"`)
  }
})
