import { expect, test } from 'vitest'

import { b } from './m-module-25e757'

test('sees the real module', () => {
  expect(b).toBe('real-b')
})
