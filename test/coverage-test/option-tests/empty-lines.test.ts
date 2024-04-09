import { expect, test } from 'vitest'

import { add } from '../src/empty-lines'

test('cover some lines', () => {
  expect(add(10, 20)).toBe(30)
})
