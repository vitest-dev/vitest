import { expect, test } from 'vitest'

test('test1', () => {
  for (const test1 of ["test1", "test1"]) {
    expect(test1).toMatchInlineSnapshot(`"test1"`)
  }
})
