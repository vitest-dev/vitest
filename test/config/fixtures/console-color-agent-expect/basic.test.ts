import { expect, test } from 'vitest'

test('internal matcher output stays uncolored in agent mode', () => {
  expect({
    nested: {
      value: 'expected',
    },
  }).toEqual({
    nested: {
      value: 'received',
    },
  })
})
