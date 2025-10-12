import { expect, test } from 'vitest'

test('soft assertion with custom diff options', () => {
  const obj1 = {
    obj: { k: 'foo' },
    arr: [1, 2],
  }
  const obj2 = {
    obj: { k: 'bar' },
    arr: [1, 3],
  }
  
  // Use soft assertion to ensure error processing goes through handleTestError
  expect.soft(obj1).toEqual(obj2)
})
