import { expect, test } from 'vitest'

test('large diff', () => {
  const x = [...Array(30)].map((_, i) => i);
  const y = [...x];
  y[0] = 1000;
  y[15] = 2000;
  y[29] = 3000;
  expect(x).toEqual(y)
})

test("printBasicPrototype", () => {
  expect({
    obj: { k: "foo" },
    arr: [1, 2]
  }).toEqual({
    obj: { k: "bar" },
    arr: [1, 3]
  });
})
