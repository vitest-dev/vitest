import { expect, test } from 'vitest'

import { b } from './m'

test('sees the real module', () => {
  expect(b).toBe('real-b')
})
