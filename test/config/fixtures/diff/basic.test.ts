import { expect, test } from 'vitest'

test("printBasicPrototype false", () => {
  expect({
    obj: { k: "foo" },
    arr: [1, 2]
  }).toEqual({
    obj: { k: "bar" },
    arr: [1, 3]
  });
})
